-- All fixtures and postings are rolled back. Run with psql against local Supabase.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
 actor UUID:=gen_random_uuid(); outsider UUID:=gen_random_uuid(); home UUID; stock UUID; house UUID;
 request UUID:=gen_random_uuid(); opening UUID; val UUID; val2 UUID; posted UUID; answer JSONB;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data)
 VALUES(actor,actor::text||'@test.invalid','{"full_name":"Asset ledger test"}');
 SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
 IF (SELECT count(*) FROM budget.thousehold_member WHERE user_id=actor)<>1 THEN RAISE EXCEPTION 'Signup membership count'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 IF to_regclass('budget.tasset_entry') IS NOT NULL THEN RAISE EXCEPTION 'Legacy asset journal still exists'; END IF;
 stock:=public.f_register_household_asset(home,'stock','Alphabet',1.5,100,'purchase_price',request,'Mi inversión','GOOGL','NASDAQ');
 IF public.f_register_household_asset(home,'stock','Alphabet',1.5,100,'purchase_price',request,'Mi inversión','GOOGL','NASDAQ')<>stock THEN RAISE EXCEPTION 'Duplicate retry'; END IF;
 BEGIN
  PERFORM public.f_register_household_asset(home,'stock','Alphabet',2,100,'purchase_price',request,'Mi inversión','GOOGL','NASDAQ');
  RAISE EXCEPTION 'Expected different-payload rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected different-payload rejection' THEN RAISE; END IF; END;
 house:=public.f_register_household_asset(home,'house','Casa',1,100000,'estimated_value',gen_random_uuid(),'Casa de campo Tiquipaya');
 SELECT opening_transaction_id INTO opening FROM budget.tasset_position WHERE id=stock;
 IF NOT EXISTS(SELECT 1 FROM budget.ttransaction WHERE id=opening AND type='opening_balance' AND currency='USD' AND ledger_book='patrimony' AND amount=150) THEN RAISE EXCEPTION 'Missing common opening journal'; END IF;
 IF (SELECT count(*) FROM budget.ttransaction_detail WHERE transaction_id=opening)<>2 THEN RAISE EXCEPTION 'Missing lines'; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.tasset_position p JOIN budget.taccount a ON a.id=p.account_id JOIN budget.tauxiliar x ON x.id=p.auxiliar_id
 WHERE p.id=house AND a.currency='USD' AND x.name='Casa de campo Tiquipaya') THEN RAISE EXCEPTION 'Missing USD account or alias auxiliar'; END IF;
 -- Later estimates change the report, never the immutable opening or journal.
 val:=public.f_record_manual_asset_valuation(stock,120,now()+interval '1 second',gen_random_uuid(),'Actualización de prueba');
 IF NOT EXISTS(SELECT 1 FROM budget.vasset_current_value WHERE id=stock AND opening_value_usd=150 AND current_value_usd=180 AND carrying_value_usd=150 AND change_since_opening_usd=30) THEN RAISE EXCEPTION 'Opening overwritten or quote auto-posted'; END IF;
 PERFORM public.f_record_manual_asset_valuation(stock,90,now()-interval '1 day',gen_random_uuid(),'Histórico');
 IF (SELECT current_value_usd FROM budget.vasset_current_value WHERE id=stock)<>180 THEN RAISE EXCEPTION 'Stale estimate replaced latest'; END IF;
 posted:=public.f_post_asset_valuation(val);
 IF public.f_post_asset_valuation(val)<>posted THEN RAISE EXCEPTION 'Posting retry duplicated journal'; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.vasset_current_value WHERE id=stock AND carrying_value_usd=180 AND opening_value_usd=150) THEN RAISE EXCEPTION 'Revaluation delta incorrect'; END IF;
 val2:=public.f_record_manual_asset_valuation(stock,0,now()+interval '2 seconds',gen_random_uuid(),'Pérdida total de prueba');
 PERFORM public.f_post_asset_valuation(val2);
 IF (SELECT carrying_value_usd FROM budget.vasset_current_value WHERE id=stock)<>0 THEN RAISE EXCEPTION 'Decrease to zero incorrect'; END IF;
 val:=public.f_record_manual_asset_valuation(house,110000,now()+interval '3 seconds',gen_random_uuid(),'Tasación documentada','appraisal');
 IF NOT EXISTS(SELECT 1 FROM budget.vasset_current_value WHERE id=house AND current_value_usd=110000 AND carrying_value_usd=100000) THEN RAISE EXCEPTION 'Manual property appraisal failed'; END IF;
 BEGIN
  PERFORM public.f_record_manual_asset_valuation(house,-1,now(),gen_random_uuid(),'Invalid');
  RAISE EXCEPTION 'Expected negative valuation rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected negative valuation rejection' THEN RAISE; END IF; END;
 BEGIN
  UPDATE budget.ttransaction_detail SET debit_base=999 WHERE transaction_id=opening;
  RAISE EXCEPTION 'Expected immutable posting rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected immutable posting rejection' THEN RAISE; END IF; END;
 -- Daily registration remains in the household currency and has balanced lines.
 answer:=public.f_register_transaction(home,'Bus de prueba',10,'transportation_fuel');
 IF NOT COALESCE((answer->>'success')::boolean,false) THEN RAISE EXCEPTION 'Daily posting failed: %',answer; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.ttransaction WHERE id=(answer->'transaction'->>'id')::uuid AND currency='BOB' AND ledger_book='operating' AND type='expense') THEN RAISE EXCEPTION 'Daily currency incorrect'; END IF;
 -- Header totals must match, and users cannot impersonate another actor.
 answer:=public.f_register_transaction(home,'Invalid',10,'transportation_fuel',p_user_id:=outsider);
 IF (answer->>'success')::boolean THEN RAISE EXCEPTION 'Actor impersonation accepted'; END IF;
 PERFORM public.f_remove_household_asset(stock);
 PERFORM public.f_remove_household_asset(stock);
 IF (SELECT status FROM budget.tasset_position WHERE id=stock)<>'inactive' OR EXISTS(SELECT 1 FROM budget.vasset_current_value WHERE id=stock) THEN RAISE EXCEPTION 'Removal failed'; END IF;
 IF EXISTS(SELECT 1 FROM budget.vaccount_balance WHERE household_id=home AND auxiliar_id=(SELECT auxiliar_id FROM budget.tasset_position WHERE id=stock) AND debit_balance<>0) THEN RAISE EXCEPTION 'Reversals did not cancel all postings'; END IF;
 IF EXISTS(SELECT t.id FROM budget.ttransaction t JOIN budget.ttransaction_detail d ON d.transaction_id=t.id WHERE t.household_id=home GROUP BY t.id HAVING sum(d.debit_base)<>sum(d.credit_base)) THEN RAISE EXCEPTION 'Unbalanced journal'; END IF;
 IF EXISTS(SELECT 1 FROM budget.ttransaction WHERE household_id=home AND ledger_book='operating' AND type<>'expense') THEN RAISE EXCEPTION 'Patrimony polluted daily journal'; END IF;
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 BEGIN
  PERFORM public.f_record_manual_asset_valuation(house,1,now(),gen_random_uuid(),'No access');
  RAISE EXCEPTION 'Expected permission denial';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected permission denial' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: unified journal, signup, USD, fractional quantity, immutable opening, valuation history, increases/decreases, reversal, daily compatibility';
END;
$$;
-- Initial country currency choice updates operating accounts, never USD assets.
DO $$ DECLARE actor UUID; home UUID; currency_choice TEXT; result JSONB; bad UUID; cash UUID; aux UUID; BEGIN
 FOREACH currency_choice IN ARRAY ARRAY['BRL','CNY'] LOOP
  actor:=gen_random_uuid();
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor::text||'@test.invalid','{"full_name":"Currency test"}');
  SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  UPDATE budget.thousehold SET currency=currency_choice WHERE id=home;
  IF EXISTS(SELECT 1 FROM budget.taccount WHERE household_id=home AND code LIKE 'PATR-%' AND currency<>'USD') THEN RAISE EXCEPTION 'Patrimony currency changed'; END IF;
  IF EXISTS(SELECT 1 FROM budget.taccount WHERE household_id=home AND code NOT LIKE 'PATR-%' AND currency<>currency_choice) THEN RAISE EXCEPTION 'Operating account currency stale'; END IF;
  result:=public.f_register_transaction(home,'Currency check',10,'transportation_fuel');
  IF NOT COALESCE((result->>'success')::boolean,false) THEN RAISE EXCEPTION 'Currency posting failed: %',result; END IF;
  IF (SELECT currency FROM budget.ttransaction WHERE id=(result->'transaction'->>'id')::uuid)<>currency_choice THEN RAISE EXCEPTION 'Transaction currency wrong'; END IF;
  BEGIN
   UPDATE budget.thousehold SET currency='EUR' WHERE id=home;
   RAISE EXCEPTION 'Expected currency freeze';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected currency freeze' THEN RAISE; END IF; END;
  SELECT id INTO STRICT cash FROM budget.taccount WHERE household_id=home AND code='110';
  SELECT auxiliar_id INTO STRICT aux FROM budget.thousehold_member WHERE household_id=home AND user_id=actor;
  BEGIN
   INSERT INTO budget.ttransaction(household_id,type,amount,currency,created_by) VALUES(home,'expense',1,currency_choice,actor) RETURNING id INTO bad;
   INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(bad,cash,aux,'Unbalanced',1,0);
   SET CONSTRAINTS ALL IMMEDIATE;
   RAISE EXCEPTION 'Expected unbalanced journal rejection';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected unbalanced journal rejection' THEN RAISE; END IF; END;
 END LOOP;
 -- Restore the outsider identity used by the read-isolation test below.
 actor:=gen_random_uuid();
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor::text||'@test.invalid','{"full_name":"Outsider test"}');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 RAISE NOTICE 'PASS: BRL/CNY operating journals, USD chart, currency freeze and deferred balance enforcement';
END; $$;
SET CONSTRAINTS ALL IMMEDIATE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM budget.tasset_position) OR EXISTS(SELECT 1 FROM budget.tasset_valuation)
 OR EXISTS(SELECT 1 FROM budget.ttransaction) OR EXISTS(SELECT 1 FROM budget.ttransaction_detail)
 OR EXISTS(SELECT 1 FROM budget.vasset_current_value) THEN RAISE EXCEPTION 'RLS exposed another household'; END IF;
 IF has_function_privilege('anon','public.f_register_transaction(uuid,character varying,numeric,text,character varying,timestamptz,character varying,character varying,text,character varying,uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous journal registration enabled'; END IF;
 IF has_function_privilege('authenticated','public.f_record_market_asset_valuation(uuid,numeric,timestamptz,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Client can forge provider quotes'; END IF;
 BEGIN
  INSERT INTO budget.thousehold_member(household_id,user_id,role) VALUES('22222222-2222-4222-8222-222222222201',auth.uid(),'admin');
  RAISE EXCEPTION 'Outsider granted themselves membership';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: outsider cannot read journal, positions or valuations; provider provenance restricted to backend';
END; $$;
RESET ROLE;
ROLLBACK;
