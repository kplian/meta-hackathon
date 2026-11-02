\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); home UUID; otherhome UUID; cash UUID; bank UUID; income UUID; expense UUID; aux UUID;
 btc UUID; dollars UUID; mid UUID; again UUID; tx UUID; r JSONB; n BIGINT; units NUMERIC; m budget.tasset_movement; member_actor UUID:=gen_random_uuid(); sol UUID; valuation UUID;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Investment movement test"}');
 SELECT household_id,auxiliar_id INTO STRICT home,aux FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT id INTO STRICT cash FROM budget.taccount WHERE household_id=home AND code='110';
 INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency) SELECT home,account_type_id,'111','Bank','BOB' FROM budget.taccount WHERE id=cash RETURNING id INTO bank;
 SELECT id INTO STRICT income FROM budget.taccount WHERE household_id=home AND code='410';
 SELECT id INTO STRICT expense FROM budget.taccount WHERE household_id=home AND code='510';
 -- Two months: 20,000 received, 15,000 spent. Today's fixture avoids fixed dates.
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book) VALUES(home,'income',20000,'BOB','operating') RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,cash,aux,'Income',20000,0),(tx,income,aux,'Income',0,20000);
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book) VALUES(home,'expense',15000,'BOB','operating') RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,expense,aux,'Expenses',15000,0),(tx,cash,aux,'Expenses',0,15000);
 r:=public.f_investment_overview(home);
 IF (r->>'available')::numeric<>5000 THEN RAISE EXCEPTION 'Expected 5000 accumulated available: %',r; END IF;
 btc:=public.f_register_household_asset(home,'crypto','BTC',1,100,'purchase_price',gen_random_uuid(),p_symbol=>'MOVEMENT-BTC/USD');
 tx:=gen_random_uuid();
 mid:=public.f_move_investment(home,tx,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',btc),2000,2,400,0.2,'Buy BTC');
 again:=public.f_move_investment(home,tx,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',btc),2000,2,400,0.2,'Buy BTC');
 IF mid<>again THEN RAISE EXCEPTION 'Retry duplicated movement'; END IF;
 r:=public.f_investment_overview(home);
 IF (r->>'available')::numeric<>3000 OR (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=btc)<>3 THEN RAISE EXCEPTION 'Purchase cash or units incorrect'; END IF;
 SELECT * INTO STRICT m FROM budget.tasset_movement WHERE id=mid;
 IF m.operating_transaction_id IS NULL OR m.patrimony_transaction_id IS NULL THEN RAISE EXCEPTION 'Missing paired journals'; END IF;
 PERFORM budget.f_check_journal(m.operating_transaction_id); PERFORM budget.f_check_journal(m.patrimony_transaction_id);
 BEGIN
  PERFORM public.f_move_investment(home,tx,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',btc),2001,2,400.2,0.2,'Buy BTC');
  RAISE EXCEPTION 'TEST FAIL: reused request accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 SELECT count(*) INTO n FROM budget.ttransaction;
 BEGIN
  PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',btc),4000,1,800,0.2);
  RAISE EXCEPTION 'TEST FAIL: overspend accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM budget.ttransaction)<>n THEN RAISE EXCEPTION 'Failed movement left journals'; END IF;
 BEGIN
  PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',btc),100,1,50,0.2);
  RAISE EXCEPTION 'TEST FAIL: mismatched FX accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 dollars:=public.f_register_household_asset(home,'cash','USD wallet',10,1,'estimated_value',gen_random_uuid(),p_unit_code=>'USD');
 -- Sell one of 3 BTC, weighted carrying cost 500 / 3, actual proceeds 200.
 mid:=public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','position','id',btc),jsonb_build_object('kind','position','id',dollars),1,200,200);
 SELECT * INTO STRICT m FROM budget.tasset_movement WHERE id=mid;
 IF m.carrying_removed_usd<>166.66666667 OR m.realized_result_usd<>33.33333333
 OR (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=dollars)<>210 THEN RAISE EXCEPTION 'Sale cost, result or USD units incorrect: %',to_jsonb(m); END IF;
 -- Withdraw USD investment to operating BOB, not ordinary monthly income.
 PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','position','id',dollars),jsonb_build_object('kind','operating','id',cash),100,500,100,0.2);
 IF budget.f_operating_available(home,cash)<>3500 THEN RAISE EXCEPTION 'Withdrawal did not return cash'; END IF;
 -- Same currency operating transfer preserves aggregate available.
 PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','operating','id',bank),500,500);
 IF (public.f_investment_overview(home)->>'available')::numeric<>3500 OR budget.f_operating_available(home,bank)<>500 THEN RAISE EXCEPTION 'Internal transfer created/lost money'; END IF;
 -- Create a purchased position atomically, without opening-equity funding.
 mid:=public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),
 '{"kind":"new","asset":{"type":"crypto","name":"SOL","symbol":"MOVEMENT-SOL/USD","alias":"New purchase"}}',1000,5,200,0.2);
 SELECT * INTO STRICT m FROM budget.tasset_movement WHERE id=mid;
 IF NOT EXISTS(SELECT 1 FROM budget.tasset_position WHERE id=m.destination_position_id AND registration_kind='purchase' AND opening_transaction_id IS NULL)
 OR (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=m.destination_position_id)<>5 THEN RAISE EXCEPTION 'New purchase used opening or lost units'; END IF;
 SELECT destination_position_id INTO sol FROM budget.tasset_movement WHERE id=mid;
 -- Same instrument custody transfer preserves carrying amount and units, no gain.
 mid:=public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','position','id',btc),
 '{"kind":"new","asset":{"type":"crypto","name":"BTC other wallet","symbol":"MOVEMENT-BTC/USD"}}',0.5,0.5,100);
 SELECT * INTO STRICT m FROM budget.tasset_movement WHERE id=mid;
 IF m.realized_result_usd<>0 OR (SELECT sum(debit_base) FROM budget.ttransaction_detail WHERE transaction_id=m.patrimony_transaction_id)<>83.33333333 THEN RAISE EXCEPTION 'Custody transfer must preserve carrying value'; END IF;
 -- Loss and closing sale remove exactly the remaining carrying value.
 PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','position','id',btc),jsonb_build_object('kind','position','id',dollars),1.5,100,100);
 IF (SELECT quantity FROM budget.vasset_quantity_balance WHERE asset_position_id=btc)<>0 THEN RAISE EXCEPTION 'Full sale left units'; END IF;
 BEGIN
  PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','position','id',btc),jsonb_build_object('kind','position','id',dollars),0.1,10,10);
  RAISE EXCEPTION 'TEST FAIL: oversale accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  UPDATE budget.ttransaction SET amount=1 WHERE id=(SELECT operating_transaction_id FROM budget.tasset_movement WHERE operating_transaction_id IS NOT NULL LIMIT 1);
  RAISE EXCEPTION 'TEST FAIL: linked journal editable';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f_remove_household_asset(btc);
  RAISE EXCEPTION 'TEST FAIL: used position removable';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 INSERT INTO auth.users(id,email) VALUES(member_actor,member_actor||'@test.invalid');
 SELECT household_id INTO otherhome FROM budget.thousehold_member WHERE user_id=member_actor;
 PERFORM set_config('request.jwt.claim.sub',member_actor::text,true);
 BEGIN
  PERFORM public.f_investment_overview(home);
  RAISE EXCEPTION 'TEST FAIL: other household visible';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 INSERT INTO budget.thousehold_member(household_id,user_id,role,member_type) VALUES(home,member_actor,'member','other');
 r:=public.f_investment_overview(home);
 IF (r->>'can_manage')::boolean THEN RAISE EXCEPTION 'Member can manage'; END IF;
 BEGIN
  PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',dollars),1,1,1,1);
  RAISE EXCEPTION 'TEST FAIL: non-admin moved funds';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 -- New movements must also update quantities used by optional valuation posting.
 PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',sol),100,1,20,0.2);
 valuation:=public.f_record_manual_asset_valuation(sol,50,now(),gen_random_uuid(),'Current units after contribution');
 IF (SELECT quantity FROM budget.tasset_valuation WHERE id=valuation)<>6 THEN RAISE EXCEPTION 'Valuation used original opening units'; END IF;
 PERFORM public.f_post_asset_valuation(valuation);
 IF (SELECT sum(d.debit_base-d.credit_base) FROM budget.ttransaction_detail d JOIN budget.tasset_position p ON p.id=sol AND p.account_id=d.account_id AND p.auxiliar_id=d.auxiliar_id)<>300 THEN RAISE EXCEPTION 'Posted valuation ignored moved units'; END IF;
 valuation:=public.f_record_manual_asset_valuation(sol,55,clock_timestamp(),gen_random_uuid(),'Snapshot before next purchase');
 PERFORM public.f_move_investment(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','position','id',sol),50,0.5,10,0.2);
 BEGIN
  PERFORM public.f_post_asset_valuation(valuation);
  RAISE EXCEPTION 'TEST FAIL: stale quantity snapshot posted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 FOR tx IN SELECT id FROM budget.ttransaction WHERE household_id=home LOOP PERFORM budget.f_check_journal(tx); END LOOP;
 PERFORM set_config('test.investment_actor',actor::text,true);
 RAISE NOTICE 'PASS investment movements: accumulated available, paired books, purchases, sales, average carrying cost, realized gain/loss, custody transfers, new positions, idempotency, overspend, units, FX, permissions and immutable postings';
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 IF EXISTS(SELECT 1 FROM budget.tasset_movement) THEN RAISE EXCEPTION 'RLS exposed movements to outsider'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.investment_actor'),true);
 IF NOT EXISTS(SELECT 1 FROM budget.tasset_movement) THEN RAISE EXCEPTION 'Owner cannot read own movement history'; END IF;
 IF has_table_privilege('authenticated','budget.tasset_movement','INSERT') OR has_table_privilege('authenticated','budget.tasset_movement','UPDATE') OR has_table_privilege('authenticated','budget.tasset_movement','DELETE') THEN RAISE EXCEPTION 'Direct movement writes allowed'; END IF;
 IF has_function_privilege('anon','public.f_move_investment(uuid,uuid,jsonb,jsonb,numeric,numeric,numeric,numeric,text)','EXECUTE') OR has_function_privilege('anon','public.f_investment_overview(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous financial RPC allowed'; END IF;
 RAISE NOTICE 'PASS: movement history RLS, owner access, read-only storage and anonymous RPC denial';
END $$;
RESET ROLE;
ROLLBACK;
