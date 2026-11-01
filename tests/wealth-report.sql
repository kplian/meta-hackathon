\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); home UUID; asset UUID; other_asset UUID; val UUID; tx UUID; acc UUID; aux UUID; counterpart UUID; r JSONB;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Wealth report test"}');
 SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 asset:=public.f_register_household_asset(home,'crypto','Solana',1,100,'purchase_price',gen_random_uuid(),'SOL ahorros','SOL/USD',p_price_as_of=>now()-interval '2 days');
 val:=public.f_record_manual_asset_valuation(asset,102,now(),gen_random_uuid(),'Test reference price');
 PERFORM public.f_post_asset_valuation(val);
 SELECT account_id,auxiliar_id INTO acc,aux FROM budget.tasset_position WHERE id=asset;
 SELECT d.account_id INTO counterpart FROM budget.ttransaction_detail d JOIN budget.tasset_position p ON p.opening_transaction_id=d.transaction_id WHERE p.id=asset AND d.credit_base>0;
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book,input_data) VALUES(home,'income',5,'USD','patrimony',jsonb_build_object('asset_position_id',asset)) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,acc,aux,'Reinvested interest',5,0),(tx,counterpart,aux,'Return counterpart',0,5);
 r:=public.f_household_wealth_report(home);
 IF (r->>'total')::numeric<>107 OR jsonb_array_length(r->'assets')<>1 OR (r->'assets'->0->>'value_usd')::numeric<>107 THEN RAISE EXCEPTION 'Expected 107, got %',r; END IF;
 -- Another observation replaces the price; it must not sum previous snapshots.
 val:=public.f_record_manual_asset_valuation(asset,103,now()-interval '1 day',gen_random_uuid(),'New reference price','appraisal');
 r:=public.f_household_wealth_report(home);
 IF (r->>'total')::numeric<>107 THEN RAISE EXCEPTION 'Snapshots duplicated or capital lost: %',r; END IF;
 other_asset:=public.f_register_household_asset(home,'house','Casa',1,893,'estimated_value',gen_random_uuid());
 r:=public.f_household_wealth_report(home);
 IF (r->>'total')::numeric<>1000 OR jsonb_array_length(r->'assets')<>2 THEN RAISE EXCEPTION 'Incorrect grouping/total: %',r; END IF;
 IF (SELECT sum((value->>'percentage')::numeric) FROM jsonb_array_elements(r->'assets'))<>100 THEN RAISE EXCEPTION 'Wrong percentages'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.f_household_wealth_report(home); RAISE EXCEPTION 'Expected authorization failure'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected authorization failure' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: 100 opening -> 102 valuation + 5 reinvested = 107, no duplicate revaluation, grouped assets, percent totals, household authorization';
END $$;
ROLLBACK;
