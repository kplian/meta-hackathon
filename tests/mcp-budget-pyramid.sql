\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); home uuid; otherhome uuid; extra uuid; template uuid;
 c text:='budget-qa-'||actor; r jsonb; result jsonb; category uuid; edu uuid; health uuid; n integer; rejected boolean;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Budget pyramid QA"}'),(outsider,outsider||'@test.invalid','{"full_name":"Budget outsider"}');
 SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
 SELECT household_id INTO STRICT otherhome FROM budget.thousehold_member WHERE user_id=outsider;
 INSERT INTO budget.tchannel(user_id,channel_type,channel_code) VALUES(actor,'telegram',c);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true); PERFORM set_config('request.jwt.claim.role','service_role',true);
 -- Without a selected pyramid, existing budget behavior remains available.
 UPDATE budget.thousehold SET financial_pyramid_id=NULL WHERE id=home;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"children_education","monthly_limit":9000}');
 IF r->>'success' IS DISTINCT FROM 'true' OR (r#>>'{data,pyramid_defined}')::boolean THEN RAISE EXCEPTION 'No-pyramid budget failed: %',r; END IF;
 PERFORM budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"children_education","monthly_limit":0}');
 INSERT INTO budget.tincome_source(household_id,name,estimated_amount,currency,frequency,created_by) VALUES(home,'Estimated salary',10000,'BOB','monthly',actor);
 SELECT id INTO STRICT template FROM budget.tfinancial_pyramid WHERE household_id IS NULL AND code='balanced' AND selectable_template;
 PERFORM public.f_select_household_pyramid(home,template,'{"needs":50,"debts":15,"personal":15,"saving":20}');
 -- Multirow writes must see earlier rows from the same statement.
 rejected:=false;
 BEGIN
  UPDATE budget.tbudget SET monthly_limit=5000 WHERE household_id=home AND budget_type_id IN
   (SELECT id FROM budget.tbudget_type WHERE household_id=home AND category_key IN ('children_education','health_pharmacy'));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Budget total%exceeds pyramid%' THEN RAISE; END IF; rejected:=true; END;
 IF NOT rejected OR (SELECT coalesce(sum(monthly_limit),0) FROM budget.tbudget WHERE household_id=home AND status='active' AND deleted_at IS NULL)<>0 THEN RAISE EXCEPTION 'Multirow write bypassed cap or left partial updates'; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"children_education","monthly_limit":6000}');
 IF r->>'success' IS DISTINCT FROM 'true' OR (r#>>'{data,spending_limit}')::numeric<>8000 OR (r#>>'{data,saving_reserved}')::numeric<>2000 THEN RAISE EXCEPTION 'Wrong capacity: %',r; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"supermarket_groceries","monthly_limit":2000}');
 IF r->>'success' IS DISTINCT FROM 'true' OR (r#>>'{data,remaining}')::numeric<>0 THEN RAISE EXCEPTION 'Exact cap rejected: %',r; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"children_education","monthly_limit":5000}');
 IF r->>'success' IS DISTINCT FROM 'true' OR (r#>>'{data,budgeted_total}')::numeric<>7000 THEN RAISE EXCEPTION 'Update counted twice: %',r; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"health_pharmacy","monthly_limit":1001}');
 IF r->>'success' IS DISTINCT FROM 'false' OR r->>'message' NOT LIKE 'Budget total%exceeds pyramid%' THEN RAISE EXCEPTION 'Over-cap request accepted: %',r; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"health_pharmacy","monthly_limit":1000}');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Remaining allowance rejected: %',r; END IF;
 -- Repeating set replaces, rather than adds to, the current category amount.
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"children_education","monthly_limit":5000}');
 IF r->>'success' IS DISTINCT FROM 'true' OR (r#>>'{data,budgeted_total}')::numeric<>8000 THEN RAISE EXCEPTION 'Set not idempotent'; END IF;
 SELECT id INTO STRICT edu FROM budget.tbudget_type WHERE household_id=home AND category_key='children_education';
 SELECT id INTO STRICT health FROM budget.tbudget_type WHERE household_id=home AND category_key='health_pharmacy';
 -- Direct frontend writes are guarded too.
 rejected:=false;
 BEGIN UPDATE budget.tbudget SET monthly_limit=1100 WHERE household_id=home AND budget_type_id=health;
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Budget total%exceeds pyramid%' THEN RAISE; END IF; rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Direct write bypassed limit'; END IF;
 UPDATE budget.tbudget SET deleted_at=now(),status='inactive' WHERE household_id=home AND budget_type_id=edu;
 r:=budget.f_family_mcp('telegram',c,'budgets','summary');
 IF (r#>>'{data,budgeted_total}')::numeric<>3000 THEN RAISE EXCEPTION 'Deleted budget still counted'; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"children_education","monthly_limit":6000}');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Restoration bypassed limit'; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"children_education","monthly_limit":5000}');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Valid restoration failed'; END IF;
 -- Same normalization as the dashboard, excluding variable and other-currency estimates.
 INSERT INTO budget.tincome_source(household_id,name,estimated_amount,currency,frequency,created_by) VALUES
 (home,'Weekly',120,'BOB','weekly',actor),(home,'Twice monthly',100,'BOB','biweekly',actor),(home,'Annual',12000,'BOB','yearly',actor),
 (home,'Variable',99999,'BOB','variable',actor),(home,'Other currency',99999,'USD','monthly',actor);
 r:=budget.f_family_mcp('telegram',c,'budgets','summary');
 IF (r#>>'{data,estimated_monthly_income}')::numeric<>11720 OR (r#>>'{data,spending_limit}')::numeric<>9376 THEN RAISE EXCEPTION 'Normalization mismatch: %',r; END IF;
 -- Lowering estimates does not rewrite existing budgets, but only corrective reductions are then allowed.
 UPDATE budget.tincome_source SET status='inactive',deleted_at=now() WHERE household_id=home AND name<>'Estimated salary';
 UPDATE budget.tincome_source SET estimated_amount=5000 WHERE household_id=home AND name='Estimated salary';
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"children_education","monthly_limit":4500}');
 IF r->>'success' IS DISTINCT FROM 'true' OR NOT (r#>>'{data,over_limit}')::boolean THEN RAISE EXCEPTION 'Corrective reduction blocked'; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"health_pharmacy","monthly_limit":1001}');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Increase allowed while already over limit'; END IF;
 UPDATE budget.tbudget SET monthly_limit=0 WHERE household_id=home;
 UPDATE budget.tincome_source SET estimated_amount=0 WHERE household_id=home;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"health_pharmacy","monthly_limit":1}');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Zero estimate should have zero allowance'; END IF;
 FOR result IN SELECT value FROM jsonb_array_elements('[{"category_key":"health_pharmacy","monthly_limit":-1},{"category_key":"unknown","monthly_limit":0},{"category_key":"health_pharmacy","monthly_limit":"250"}]') LOOP
  r:=budget.f_family_mcp('telegram',c,'budgets','set',result); IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Invalid input accepted'; END IF;
 END LOOP;
 -- Extremes: saving 100% allows zero spending; saving 0% allows the full estimate.
 UPDATE budget.tincome_source SET estimated_amount=10000 WHERE household_id=home AND name='Estimated salary';
 PERFORM public.f_select_household_pyramid(home,template,'{"needs":0,"debts":0,"personal":0,"saving":100}',true);
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"health_pharmacy","monthly_limit":1}');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION '100 percent saving reserve consumed'; END IF;
 PERFORM public.f_select_household_pyramid(home,template,'{"needs":100,"debts":0,"personal":0,"saving":0}',true);
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"health_pharmacy","monthly_limit":10000}');
 IF r->>'success' IS DISTINCT FROM 'true' OR (r#>>'{data,remaining}')::numeric<>0 THEN RAISE EXCEPTION 'Zero saving should allow full estimate'; END IF;
 r:=budget.f_family_mcp('telegram',c,'household','create','{"name":"Budget work QA","currency":"BOB"}','budget-work');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Extra household failed'; END IF;
 extra:=(r#>>'{data,household,id}')::uuid;
 r:=budget.f_family_mcp('telegram',c,'budgets','set','{"category_key":"health_pharmacy","monthly_limit":1}');
 IF r->>'error'<>'SELECT_HOUSEHOLD' THEN RAISE EXCEPTION 'Multi-household target guessed'; END IF;
 r:=budget.f_family_mcp('telegram',c,'budgets','set',jsonb_build_object('household_id',otherhome,'category_key','health_pharmacy','monthly_limit',0));
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Foreign household write accepted'; END IF;
 -- A rejected direct foreign-household write must not disclose its capacity.
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 rejected:=false;
 BEGIN
  UPDATE budget.tbudget SET monthly_limit=999999 WHERE household_id=otherhome;
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Household access denied' THEN RAISE; END IF; rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Foreign capacity reached from frontend write'; END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 UPDATE budget.tincome_source SET estimated_amount='NaN'::numeric WHERE household_id=home AND name='Estimated salary';
 r:=budget.f_family_mcp('telegram',c,'budgets','summary',jsonb_build_object('household_id',home));
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Nonfinite income produced a spendable budget cap'; END IF;
 UPDATE budget.tincome_source SET estimated_amount=10000 WHERE household_id=home AND name='Estimated salary';
 UPDATE budget.thousehold_member SET role='member' WHERE user_id=actor AND household_id=home;
 r:=budget.f_family_mcp('telegram',c,'budgets','set',jsonb_build_object('household_id',home,'category_key','health_pharmacy','monthly_limit',0));
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Non-admin changed budget'; END IF;
 IF EXISTS(SELECT 1 FROM budget.ttransaction WHERE household_id IN(home,extra)) THEN RAISE EXCEPTION 'Budgets generated accounting entries'; END IF;
 RAISE NOTICE 'PASS budgets: cap=income-saving, exact limit, replacement, direct writes, restoration, normalization, corrective reductions, zero income, scopes and permissions';
END $$;
ROLLBACK;
