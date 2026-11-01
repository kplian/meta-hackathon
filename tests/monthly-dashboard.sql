\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); outsider UUID:=gen_random_uuid(); home UUID; category UUID; acct UUID; aux UUID; tx UUID; plan UUID; r JSONB; level JSONB;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Monthly dashboard test"}');
 SELECT household_id,auxiliar_id INTO STRICT home,aux FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 plan:=public.f_select_household_pyramid(home,'f8505c97-2cac-4184-ad23-72c9d5086e03','{"needs":40,"debts":10,"personal":10,"saving":40}');
 r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
 IF (r->>'income')::numeric<>0 OR (r->>'expenses')::numeric<>0 THEN RAISE EXCEPTION 'Empty household must show zeros'; END IF;
 INSERT INTO budget.tincome_source(household_id,name,estimated_amount,currency,frequency) VALUES
 (home,'Monthly',9000,'BOB','monthly'),(home,'Annual',12000,'BOB','yearly'),
 (home,'Variable',99999,'BOB','variable'),(home,'Foreign',99999,'USD','monthly');
 SELECT id INTO STRICT category FROM budget.tbudget_type WHERE household_id=home AND category_key='supermarket_groceries';
 SELECT id INTO acct FROM budget.taccount WHERE household_id=home AND currency='BOB' AND is_postable LIMIT 1;
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date) VALUES(home,'income',10000,'BOB',0,now());
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date) VALUES(home,'expense',600,'BOB',0,now()) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,budget_type_id,description,debit_base,credit_base) VALUES(tx,acct,aux,category,'test debit',600,0),(tx,acct,aux,category,'test credit',0,600);
 -- Previous month and next month, voided movements, foreign currency, and
 -- patrimony opening balances must not change the current household totals.
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date,status,ledger_book) VALUES
 (home,'income',90000,'BOB',0,date_trunc('month',now() AT TIME ZONE 'America/La_Paz') AT TIME ZONE 'America/La_Paz'-interval '1 second','active','operating'),
 (home,'income',90000,'BOB',0,(date_trunc('month',now() AT TIME ZONE 'America/La_Paz')+interval '1 month') AT TIME ZONE 'America/La_Paz','active','operating'),
 (home,'expense',90000,'BOB',0,now(),'voided','operating'),
 (home,'income',90000,'USD',0,now(),'active','operating'),
 (home,'opening_balance',90000,'USD',0,now(),'active','patrimony');
 r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
 SELECT value INTO STRICT level FROM jsonb_array_elements(r->'levels') WHERE value->>'code'='needs';
 IF (r->>'estimated_income')::numeric<>10000 OR (r->>'excluded_estimates')::int<>2 THEN RAISE EXCEPTION 'Wrong monthly estimate: %',r; END IF;
 IF (r->>'income')::numeric<>10000 OR (r->>'expenses')::numeric<>600 OR (level->>'allocated')::numeric<>4000 OR (level->>'spent')::numeric<>600 OR (r->>'unclassified')::numeric<>0 OR (r->>'excluded_currency_count')::int<>1 THEN RAISE EXCEPTION 'Incorrect monthly totals: %',r; END IF;
 IF (level->>'spent')::numeric/(level->>'allocated')::numeric*100<>15 THEN RAISE EXCEPTION 'Expected 15 percent usage'; END IF;
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version) VALUES(home,'income',5000,'BOB',0);
 r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
 IF (r->>'income')::numeric<>15000 OR (SELECT (value->>'allocated')::numeric FROM jsonb_array_elements(r->'levels') WHERE value->>'code'='needs')<>4000 THEN RAISE EXCEPTION 'Actual income changed the estimated budget'; END IF;
 -- Legacy expense with a global category must follow the household category mapping.
 SELECT id INTO category FROM budget.tbudget_type WHERE household_id IS NULL AND category_key='supermarket_groceries';
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version) VALUES(home,'expense',200,'BOB',0) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,budget_type_id,description,debit_base,credit_base) VALUES(tx,acct,aux,category,'legacy debit',200,0),(tx,acct,aux,category,'legacy credit',0,200);
 r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
 IF (SELECT (value->>'spent')::numeric FROM jsonb_array_elements(r->'levels') WHERE value->>'code'='needs')<>800 THEN RAISE EXCEPTION 'Legacy categories not mapped'; END IF;
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version) VALUES(home,'expense',100,'BOB',0);
 r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
 IF (r->>'unclassified')::numeric<>100 THEN RAISE EXCEPTION 'Unclassified expense hidden'; END IF;
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 BEGIN
  PERFORM public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
  RAISE EXCEPTION 'Expected access rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected access rejection' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: 10000 income, 4000 assigned, 600 spent (15%%), no double counting, month boundaries, currencies, unclassified, household authorization';
END $$;
ROLLBACK;
