\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); home UUID; btc UUID; wallet UUID; manual_asset UUID; q UUID; acct UUID; aux UUID; equity UUID; tx UUID; r JSONB; item JSONB; entries BIGINT;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Current units wealth test"}');
 SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 q:=public.f_upsert_asset_quote('crypto','WEALTHBTC/USD','',200,now()-interval '1 minute');
 btc:=public.f_register_household_asset(home,'crypto','Bitcoin',1,100,'purchase_price',gen_random_uuid(),'Binance','WEALTHBTC/USD');
 SELECT account_id,auxiliar_id INTO acct,aux FROM budget.tasset_position WHERE id=btc;
 SELECT id INTO equity FROM budget.taccount WHERE household_id=home AND code='PATR-OPENING';
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book,input_data) VALUES(home,'asset_purchase',50,'USD','patrimony',jsonb_build_object('asset_position_id',btc)) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,quantity,debit_base,credit_base,asset_position_id,asset_quantity_delta) VALUES
 (tx,acct,aux,'Additional BTC',999,50,0,btc,0.5),(tx,equity,aux,'Counterpart',999,0,50,NULL,NULL);
 r:=public.f_household_wealth_report(home);
 item:=r->'assets'->0;
 IF (r->>'total')::numeric<>300 OR (item->>'current_quantity')::numeric<>1.5 OR item->>'valuation_basis'<>'shared_quote' THEN RAISE EXCEPTION 'Expected 1.5 x 200, not sum of costs: %',r; END IF;
 wallet:=public.f_register_household_asset(home,'crypto','Bitcoin',0.25,100,'purchase_price',gen_random_uuid(),'Other wallet','WEALTHBTC/USD');
 r:=public.f_household_wealth_report(home);
 IF (r->>'total')::numeric<>350 OR jsonb_array_length(r->'assets')<>2 THEN RAISE EXCEPTION 'Shared quote across custody positions failed'; END IF;
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book) VALUES(home,'income',5,'USD','patrimony') RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,asset_position_id,asset_quantity_delta) VALUES
 (tx,acct,aux,'BTC reward',5,0,btc,0.025),(tx,equity,aux,'Counterpart',0,5,NULL,NULL);
 r:=public.f_household_wealth_report(home);
 IF (r->>'total')::numeric<>355 THEN RAISE EXCEPTION 'Reward counted twice or ignored'; END IF;
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book) VALUES(home,'asset_sale',100,'USD','patrimony') RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,asset_position_id,asset_quantity_delta) VALUES
 (tx,acct,aux,'BTC reduction',0,100,btc,-0.5),(tx,equity,aux,'Counterpart',100,0,NULL,NULL);
 r:=public.f_household_wealth_report(home);
 IF (r->>'total')::numeric<>255 THEN RAISE EXCEPTION 'Sale did not reduce units'; END IF;
 SELECT count(*) INTO entries FROM budget.ttransaction;
 PERFORM public.f_upsert_asset_quote('crypto','WEALTHBTC/USD','',250,now());
 r:=public.f_household_wealth_report(home);
 IF (r->>'total')::numeric<>318.75 OR (SELECT count(*) FROM budget.ttransaction)<>entries THEN RAISE EXCEPTION 'Price refresh did not update report without postings'; END IF;
 manual_asset:=public.f_register_household_asset(home,'stock','No provider price',2,12,'purchase_price',gen_random_uuid(),p_symbol=>'NOQUOTE-TEST',p_exchange=>'NASDAQ');
 r:=public.f_household_wealth_report(home);
 SELECT value INTO STRICT item FROM jsonb_array_elements(r->'assets') WHERE value->>'id'=manual_asset::text;
 IF NOT (item->>'quote_missing')::boolean OR item->>'valuation_basis'<>'initial_reference' OR (item->>'value_usd')::numeric<>24 THEN RAISE EXCEPTION 'Missing quote silently hidden'; END IF;
 PERFORM public.f_record_manual_asset_valuation(manual_asset,13,now(),gen_random_uuid(),'Manual reference');
 r:=public.f_household_wealth_report(home);
 SELECT value INTO STRICT item FROM jsonb_array_elements(r->'assets') WHERE value->>'id'=manual_asset::text;
 IF item->>'valuation_basis'<>'position_valuation' OR (item->>'value_usd')::numeric<>26 THEN RAISE EXCEPTION 'Individual valuation fallback failed'; END IF;
 manual_asset:=public.f_register_household_asset(home,'house','House',1,3000,'estimated_value',gen_random_uuid());
 PERFORM public.f_record_manual_asset_valuation(manual_asset,3200,now(),gen_random_uuid(),'House appraisal','appraisal');
 r:=public.f_household_wealth_report(home);
 SELECT value INTO STRICT item FROM jsonb_array_elements(r->'assets') WHERE value->>'id'=manual_asset::text;
 IF (item->>'quote_missing')::boolean OR (item->>'value_usd')::numeric<>3200 THEN RAISE EXCEPTION 'Physical appraisal failed'; END IF;
 IF abs((SELECT sum((value->>'percentage')::numeric) FROM jsonb_array_elements(r->'assets'))-100)>0.000001 THEN RAISE EXCEPTION 'Wrong chart shares'; END IF;
 PERFORM public.f_remove_household_asset(wallet);
 r:=public.f_household_wealth_report(home);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r->'assets') WHERE value->>'id'=wallet::text) THEN RAISE EXCEPTION 'Inactive position included'; END IF;
 RAISE NOTICE 'PASS: current BTC units, shared price, multiple wallets, rewards/sales, quote-only refresh, manual/initial fallbacks, chart percentages and inactive positions';
END $$;
ROLLBACK;
