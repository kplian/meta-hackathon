\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor uuid:=gen_random_uuid(); h uuid; cash uuid; aux uuid; tx uuid; btc uuid; mid uuid; m budget.tasset_movement;
 rate numeric; amount numeric; usd numeric; initial_balance numeric; c text:='985302991234'; r jsonb; rejected boolean;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"FX precision fixture"}');
 SELECT household_id,auxiliar_id INTO STRICT h,aux FROM budget.thousehold_member WHERE user_id=actor;
 SELECT id INTO STRICT cash FROM budget.taccount WHERE household_id=h AND code='110';
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book) VALUES(h,'income',1000000,'BOB','operating') RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base)
 SELECT tx,cash,aux,'Fixture income',1000000,0 UNION ALL SELECT tx,id,aux,'Fixture income',0,1000000 FROM budget.taccount WHERE household_id=h AND code='410';
 btc:=public.f_register_household_asset(h,'crypto','FX BTC',1,78000,'purchase_price',gen_random_uuid(),p_symbol=>'FX-TEST-BTC/USD');
 initial_balance:=budget.f_operating_available(h,cash);
 -- Repeating reciprocal, official-style rate, a finite decimal and unit identity.
 FOR rate,amount,usd IN SELECT * FROM (VALUES
  (0.08333333333333333::numeric,1200::numeric,100::numeric),
  (1/6.96::numeric,696::numeric,100::numeric),
  (0.125::numeric,800::numeric,100::numeric),
  (1::numeric,100::numeric,100::numeric)) cases(rate,amount,usd)
 LOOP
  mid:=public.f_move_investment(h,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),
   jsonb_build_object('kind','position','id',btc),amount,usd/78000,usd,rate,'FX precision purchase');
  SELECT * INTO STRICT m FROM budget.tasset_movement WHERE id=mid;
  IF m.settlement_usd<>usd OR m.usd_per_household_unit<>round(rate,24) THEN RAISE EXCEPTION 'Rate or settlement lost precision'; END IF;
  PERFORM budget.f_check_journal(m.operating_transaction_id); PERFORM budget.f_check_journal(m.patrimony_transaction_id);
  mid:=public.f_move_investment(h,gen_random_uuid(),jsonb_build_object('kind','position','id',btc),
   jsonb_build_object('kind','operating','id',cash),usd/78000,amount,usd,rate,'FX precision sale');
  SELECT * INTO STRICT m FROM budget.tasset_movement WHERE id=mid;
  PERFORM budget.f_check_journal(m.operating_transaction_id); PERFORM budget.f_check_journal(m.patrimony_transaction_id);
 END LOOP;
 IF budget.f_operating_available(h,cash)<>initial_balance THEN RAISE EXCEPTION 'Buy/sell cash did not balance'; END IF;
 -- Still reject a wrong rate; no weakened settlement tolerance.
 rejected:=false;
 BEGIN
  PERFORM public.f_move_investment(h,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),
   jsonb_build_object('kind','position','id',btc),1200,100/78000::numeric,100,0.08,'Must reject mismatch');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE 'USD settlement must match%' THEN RAISE; END IF; rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Wrong FX accepted'; END IF;
 -- Exercise the actual MCP gateway/private snapshot too, without persistent data.
 INSERT INTO budget.tchannel(user_id,channel_type,channel_code) VALUES(actor,'telegram',c);
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 r:=budget.f_family_mcp('telegram',c,'assets','move',jsonb_build_object(
  'source',jsonb_build_object('kind','operating','id',cash),
  'destination',jsonb_build_object('kind','position','id',btc),
  'source_quantity',1200,'destination_quantity',0.0012820512820513,
  'settlement_usd',100,'usd_per_household_unit',0.08333333333333333),'precision-fixture');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'MCP reciprocal FX failed: %',r; END IF;
END $$;
ROLLBACK;
