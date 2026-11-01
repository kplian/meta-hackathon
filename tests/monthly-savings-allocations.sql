\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor uuid; home uuid; aux uuid; cash uuid; r jsonb; before_r jsonb; btc uuid; vault uuid; usd_vault uuid; second_usd uuid;
 request uuid; period_start timestamptz; old_date timestamptz; tx uuid; income_account uuid; expense_account uuid; scenario int; amount numeric;
BEGIN
 period_start:=date_trunc('month',now() AT TIME ZONE 'America/La_Paz') AT TIME ZONE 'America/La_Paz';
 old_date:=period_start-interval '1 day';
 FOR scenario IN 1..8 LOOP
  actor:=gen_random_uuid();
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Savings cases"}');
  SELECT household_id,auxiliar_id INTO STRICT home,aux FROM budget.thousehold_member WHERE user_id=actor;
  SELECT id INTO STRICT cash FROM budget.taccount WHERE household_id=home AND code='110';
  SELECT id INTO STRICT income_account FROM budget.taccount WHERE household_id=home AND code='410';
  SELECT id INTO STRICT expense_account FROM budget.taccount WHERE household_id=home AND code='510';
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM public.f_select_household_pyramid(home,'f8505c97-2cac-4184-ad23-72c9d5086e02','{"needs":50,"debts":15,"personal":15,"saving":20}');
  INSERT INTO budget.tincome_source(household_id,name,estimated_amount,currency,frequency) VALUES(home,'Salary',10000,'BOB','monthly');
  -- Last month's savings: 6000 - 4000 = 2000, still held as cash.
  INSERT INTO budget.ttransaction(household_id,type,amount,currency,transaction_date) VALUES(home,'income',6000,'BOB',old_date) RETURNING id INTO tx;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,cash,aux,'Prior income',6000,0),(tx,income_account,aux,'Prior income',0,6000);
  INSERT INTO budget.ttransaction(household_id,type,amount,currency,transaction_date) VALUES(home,'expense',4000,'BOB',old_date) RETURNING id INTO tx;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,expense_account,aux,'Prior expense',4000,0),(tx,cash,aux,'Prior expense',0,4000);
  IF scenario<>2 THEN
   r:=budget.f_register_transaction(p_household_id=>home,p_concept=>'Current salary',p_amount=>10000,p_category=>'income_general',p_type=>'income',p_auxiliar_id=>aux);
   IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Income failed %',r; END IF;
  END IF;
  btc:=public.f_register_household_asset(home,'crypto','BTC',1,100,'purchase_price',gen_random_uuid(),p_symbol=>'SAVINGS-CASE-BTC/USD');
  before_r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
  IF (before_r->'savings'->>'previous_generated')::numeric<>2000 OR (before_r->'savings'->>'target')::numeric<>2000 THEN RAISE EXCEPTION 'Period or target incorrect %',before_r; END IF;
  IF scenario IN(1,2,3) THEN
   -- Invest first (1), invest prior-month savings (2), or invest after spending (3).
   IF scenario=3 THEN
    r:=budget.f_register_transaction(p_household_id=>home,p_concept=>'Monthly spending',p_amount=>8000,p_category=>'supermarket_groceries',p_type=>'expense',p_auxiliar_id=>aux);
   END IF;
   request:=gen_random_uuid();
   PERFORM public.f_move_investment(home,request,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',btc),2000,2,400,0.2,'Savings investment');
   PERFORM public.f_move_investment(home,request,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',btc),2000,2,400,0.2,'Savings investment');
   r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
   IF (r->'savings'->>'investment_contributions')::numeric<>2000 OR (r->'savings'->>'previous_generated')::numeric<>2000 THEN RAISE EXCEPTION 'Transfer doubled or prior month changed %',r; END IF;
   IF scenario=1 THEN
    IF (r->'savings'->>'generated')::numeric<>10000 OR (r->>'expenses')::numeric<>0 THEN RAISE EXCEPTION 'Early investment counted as spending %',r; END IF;
    r:=budget.f_register_transaction(p_household_id=>home,p_concept=>'Later spending',p_amount=>8000,p_category=>'supermarket_groceries',p_type=>'expense',p_auxiliar_id=>aux);
   END IF;
   r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
   amount:=CASE WHEN scenario=2 THEN 0 ELSE 2000 END;
   IF (r->'savings'->>'generated')::numeric<>amount OR (r->'savings'->>'achieved')::boolean<>(scenario<>2) THEN RAISE EXCEPTION 'Scenario % target/current saving incorrect %',scenario,r; END IF;
   -- Withdrawing an investment is neither new earned income nor negative saving.
   PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','position','id',btc),jsonb_build_object('kind','operating','id',cash),1,1000,200,0.2,'Return cash');
   r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
   IF (r->'savings'->>'generated')::numeric<>amount OR (r->'savings'->>'investment_returns')::numeric<>1000 THEN RAISE EXCEPTION 'Withdrawal counted as income %',r; END IF;
  ELSIF scenario IN(4,5) THEN
   vault:=public.f_create_saving_vault(home,gen_random_uuid(),'Travel','BOB',12000);
   usd_vault:=public.f_create_saving_vault(home,gen_random_uuid(),'USD travel','USD',2000);
   second_usd:=public.f_create_saving_vault(home,gen_random_uuid(),'Other USD','USD');
   request:=gen_random_uuid();
   PERFORM public.f_transfer_saving_vault(home,request,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',vault),1300,1300);
   PERFORM public.f_transfer_saving_vault(home,request,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',vault),1300,1300);
   PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',usd_vault),700,100,7);
   PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','vault','id',usd_vault),jsonb_build_object('kind','vault','id',second_usd),50,50);
   PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','vault','id',second_usd),jsonb_build_object('kind','vault','id',vault),10,70,7);
   r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
   IF (r->'savings'->>'vault_contributions')::numeric<>2000 OR (r->>'expenses')::numeric<>0 OR (r->'savings'->>'generated')::numeric<>10000 THEN RAISE EXCEPTION 'Vault double counting or FX conversion %',r; END IF;
   PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','vault','id',second_usd),jsonb_build_object('kind','operating','id',cash),10,70,7);
   r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
   IF (r->'savings'->>'vault_returns')::numeric<>70 OR (r->'savings'->>'generated')::numeric<>10000 THEN RAISE EXCEPTION 'Vault return counted as new saving %',r; END IF;
   IF scenario=5 THEN
    r:=budget.f_register_transaction(p_household_id=>home,p_concept=>'Spend previous cash too',p_amount=>10050,p_category=>'supermarket_groceries',p_type=>'expense',p_auxiliar_id=>aux);
    r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
    IF (r->'savings'->>'generated')::numeric<>-50 OR (r->'savings'->>'achieved')::boolean OR (r->'savings'->>'gap')::numeric<>2050 THEN RAISE EXCEPTION 'Transfers hide deficit %',r; END IF;
   END IF;
  ELSIF scenario=7 THEN
   -- End-of-month saver: cash is still available, never transferred anywhere.
   r:=budget.f_register_transaction(p_household_id=>home,p_concept=>'Spending without investing',p_amount=>8000,p_category=>'supermarket_groceries',p_type=>'expense',p_auxiliar_id=>aux);
   r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
   IF (r->'savings'->>'generated')::numeric<>2000 OR NOT (r->'savings'->>'achieved')::boolean
    OR (r->'savings'->>'investment_contributions')::numeric<>0 OR (r->'savings'->>'vault_contributions')::numeric<>0 THEN RAISE EXCEPTION 'Untransferred savings not recognized %',r; END IF;
  ELSIF scenario=8 THEN
   -- The old savings category posts to asset 130 despite an expense header.
   r:=budget.f_register_transaction(p_household_id=>home,p_concept=>'Legacy saving category',p_amount=>2000,p_category=>'savings_investments',p_type=>'expense',p_auxiliar_id=>aux);
   r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
   IF (r->>'expenses')::numeric<>0 OR (r->'savings'->>'investment_contributions')::numeric<>2000 OR (r->'savings'->>'generated')::numeric<>10000 THEN RAISE EXCEPTION 'Legacy transfer counted as spending %',r; END IF;
  ELSE
   -- A future salary, voided entry, valuation and opening position do not meet this month's goal.
   INSERT INTO budget.ttransaction(household_id,type,amount,currency,transaction_date,ledger_version) VALUES(home,'income',90000,'BOB',now()+interval '1 minute',0);
   INSERT INTO budget.ttransaction(household_id,type,amount,currency,status,ledger_version) VALUES(home,'income',90000,'BOB','voided',0);
   UPDATE budget.tincome_source SET status='inactive' WHERE household_id=home;
   r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
   IF (r->>'income')::numeric<>10000 OR (r->'savings'->>'target')::numeric<>0 OR (r->'savings'->>'achieved')::boolean THEN RAISE EXCEPTION 'Zero goal, future or voided incorrect %',r; END IF;
  END IF;
  r:=public.f_monthly_pyramid_dashboard(home,'America/La_Paz');
  before_r:=public.f_member_expenses_report(home,'America/La_Paz');
  IF (before_r->>'total')::numeric<>(r->>'expenses')::numeric THEN RAISE EXCEPTION 'Member pie disagrees with consumption % vs %',before_r,r; END IF;
  -- A following-month transfer cannot rewrite the completed-month result.
  r:=public.f_closed_month_savings_report(home,'America/La_Paz');
  IF (r->'months'->9->>'saving')::numeric<>2000 THEN RAISE EXCEPTION 'Prior-month savings changed %',r; END IF;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  BEGIN PERFORM public.f_monthly_pyramid_dashboard(home,'America/La_Paz'); RAISE EXCEPTION 'TEST FAIL access'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='TEST FAIL access' THEN RAISE; END IF; END;
 END LOOP;
 RAISE NOTICE 'PASS eight scenarios: untransferred savings, legacy category, invest first/last, prior savings invested now, withdrawals, home/USD vaults, internal transfers, retries, deficit, no goal, closed months and permissions';
END $$;
ROLLBACK;
