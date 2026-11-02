\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); home UUID; btc UUID; cash UUID; q UUID; same_q UUID; account UUID; aux UUID; cash_account UUID; cash_aux UUID; tx UUID; observation UUID; original_tx UUID;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Shared quotes and units test"}');
 SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 q:=public.f_upsert_asset_quote('crypto','TESTBTC/USD','Binance',102,now()-interval '1 minute');
 btc:=public.f_register_household_asset(home,'crypto','Test BTC',1,100,'purchase_price',gen_random_uuid(),p_symbol=>'TESTBTC/USD');
 SELECT account_id,auxiliar_id,opening_transaction_id INTO account,aux,original_tx FROM budget.tasset_position WHERE id=btc;
 IF NOT EXISTS(SELECT 1 FROM budget.tasset_position WHERE id=btc AND instrument_quote_id=q AND reference_unit_price_usd=100) THEN RAISE EXCEPTION 'Historical cost confused with quote'; END IF;
 IF (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=btc)<>1 THEN RAISE EXCEPTION 'Opening counted incorrectly'; END IF;
 IF (SELECT unit_price_usd FROM budget.tasset_quote WHERE id=q)<>102 THEN RAISE EXCEPTION 'Acquisition price replaced provider price'; END IF;
 same_q:=public.f_upsert_asset_quote('crypto','TESTBTC/USD','',103,now());
 IF same_q<>q THEN RAISE EXCEPTION 'Duplicate shared instrument'; END IF;
 PERFORM public.f_upsert_asset_quote('crypto','TESTBTC/USD','',90,now()-interval '1 day');
 IF (SELECT unit_price_usd FROM budget.tasset_quote WHERE id=q)<>103 THEN RAISE EXCEPTION 'Stale quote replaced latest'; END IF;
 cash:=public.f_register_household_asset(home,'cash','USD wallet',1000,1,'estimated_value',gen_random_uuid(),p_unit_code=>'USD');
 SELECT account_id,auxiliar_id INTO cash_account,cash_aux FROM budget.tasset_position WHERE id=cash;
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book,input_data) VALUES(home,'asset_purchase',60,'USD','patrimony',jsonb_build_object('asset_position_id',btc)) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,quantity,debit_base,credit_base,asset_position_id,asset_quantity_delta) VALUES
 (tx,account,aux,'More BTC',77,60,0,btc,0.5),(tx,cash_account,cash_aux,'USD payment',77,0,60,cash,-60);
 PERFORM budget.f_check_journal(tx);
 IF (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=btc)<>1.5 OR (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=cash)<>940 THEN RAISE EXCEPTION 'Signed units not accumulated'; END IF;
 observation:=public.f_record_manual_asset_valuation(btc,105,now(),gen_random_uuid(),'Test revaluation');
 PERFORM public.f_post_asset_valuation(observation);
 IF (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=btc)<>1.5 THEN RAISE EXCEPTION 'Revaluation changed units'; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.ttransaction_detail WHERE transaction_id=original_tx AND account_id=account AND debit_base=100) THEN RAISE EXCEPTION 'Quote rewrote original accounting'; END IF;
 PERFORM set_config('test.quote_id',q::text,true);
 PERFORM public.f_remove_household_asset(btc);
 IF (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=btc)<>0 THEN RAISE EXCEPTION 'Reversal failed to reverse units'; END IF;
 RAISE NOTICE 'PASS: signed units, 1+0.5 BTC, fiat units, zero-unit revaluation, quote reuse, stale protection, historical cost unchanged, reversal';
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM budget.tasset_quote WHERE id=current_setting('test.quote_id')::uuid) THEN RAISE EXCEPTION 'Public price unavailable'; END IF;
 BEGIN PERFORM public.f_upsert_asset_quote('crypto','TESTBTC/USD','',1,now()); RAISE EXCEPTION 'Expected quote publication rejection'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE budget.tasset_quote SET unit_price_usd=1 WHERE id=current_setting('test.quote_id')::uuid; RAISE EXCEPTION 'Expected direct quote write rejection'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
