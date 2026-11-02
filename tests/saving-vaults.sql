\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); home UUID; cash UUID; capital UUID; aux UUID; bob UUID; usd UUID; usd2 UUID; req UUID; tx UUID; again UUID;
 r JSONB; n BIGINT; outsider UUID:=gen_random_uuid(); otherhome UUID; othercash UUID; curr TEXT;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Vault test"}');
 SELECT household_id,auxiliar_id INTO STRICT home,aux FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT id INTO cash FROM budget.taccount WHERE household_id=home AND code='110';
 SELECT id INTO capital FROM budget.taccount WHERE household_id=home AND code='310';
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book) VALUES(home,'opening_balance',10000,'BOB','operating') RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,cash,aux,'Initial cash',10000,0),(tx,capital,aux,'Opening',0,10000);
 req:=gen_random_uuid();
 bob:=public.f_create_saving_vault(home,req,'Viaje','BOB',12000);
 again:=public.f_create_saving_vault(home,req,'Viaje','BOB',12000);
 IF again<>bob THEN RAISE EXCEPTION 'Create retry duplicated vault'; END IF;
 usd:=public.f_create_saving_vault(home,gen_random_uuid(),'Viaje USD','USD');
 usd2:=public.f_create_saving_vault(home,gen_random_uuid(),'Emergencias USD','USD');
 IF (SELECT count(DISTINCT vault_account_id) FROM budget.tauxiliar WHERE id IN(usd,usd2))<>1 THEN RAISE EXCEPTION 'Same currency must share the chart account'; END IF;
 r:=public.f_saving_vaults(home);
 IF jsonb_array_length(r->'vaults')<>3 OR budget.f_vault_balance(bob)<>0 OR EXISTS(SELECT 1 FROM budget.tasset_position WHERE household_id=home) THEN RAISE EXCEPTION 'Empty vault created a balance or asset position'; END IF;
 req:=gen_random_uuid();
 PERFORM public.f_transfer_saving_vault(home,req,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',bob),5000,5000);
 PERFORM public.f_transfer_saving_vault(home,req,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',bob),5000,5000);
 IF budget.f_operating_available(home,cash)<>5000 OR budget.f_vault_balance(bob)<>5000 OR (SELECT count(*) FROM budget.ttransaction WHERE vault_request_id=req)<>1 THEN RAISE EXCEPTION 'Native deposit or retry wrong'; END IF;
 PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','vault','id',bob),jsonb_build_object('kind','operating','id',cash),1000,1000);
 IF budget.f_operating_available(home,cash)<>6000 OR budget.f_vault_balance(bob)<>4000 THEN RAISE EXCEPTION 'Release did not return available cash'; END IF;
 req:=gen_random_uuid();
 PERFORM public.f_transfer_saving_vault(home,req,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',usd),700,100,7,'USD deposit');
 IF budget.f_operating_available(home,cash)<>5300 OR budget.f_vault_balance(usd)<>100 OR (SELECT count(*) FROM budget.ttransaction WHERE vault_request_id=req)<>2 THEN RAISE EXCEPTION 'Cross currency deposit incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.ttransaction WHERE vault_request_id=req AND currency='USD' AND household_currency_at_posting='BOB' AND household_fx_rate=7) THEN RAISE EXCEPTION 'Missing rate snapshot'; END IF;
 PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','vault','id',usd),jsonb_build_object('kind','vault','id',bob),20,140,7);
 PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','vault','id',usd),jsonb_build_object('kind','vault','id',usd2),10,10);
 IF budget.f_vault_balance(usd)<>70 OR budget.f_vault_balance(usd2)<>10 OR budget.f_vault_balance(bob)<>4140 THEN RAISE EXCEPTION 'Vault to vault transfer incorrect'; END IF;
 IF budget.f_operating_available(home,cash)+budget.f_vault_balance(bob)+(budget.f_vault_balance(usd)+budget.f_vault_balance(usd2))*7<>10000 THEN RAISE EXCEPTION 'Transfers created or destroyed cash'; END IF;
 IF EXISTS(SELECT 1 FROM budget.ttransaction WHERE household_id=home AND type IN('income','expense')) THEN RAISE EXCEPTION 'Funding was misclassified as income or expense'; END IF;
 SELECT count(*) INTO n FROM budget.ttransaction;
 BEGIN
  PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',usd),6000,1000,6);
  RAISE EXCEPTION 'TEST FAIL: overspend accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','vault','id',usd),jsonb_build_object('kind','operating','id',cash),71,497,7);
  RAISE EXCEPTION 'TEST FAIL: vault overdraw accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',usd),700,100,8);
  RAISE EXCEPTION 'TEST FAIL: bad FX accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM budget.ttransaction)<>n THEN RAISE EXCEPTION 'Failed transfers left partial postings'; END IF;
 BEGIN
  PERFORM public.f_transfer_saving_vault(home,req,jsonb_build_object('kind','operating','id',cash),jsonb_build_object('kind','vault','id',usd),700,100,7,'Different retry');
  RAISE EXCEPTION 'TEST FAIL: changed retry accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  UPDATE budget.tauxiliar SET vault_account_id=(SELECT vault_account_id FROM budget.tauxiliar WHERE id=bob) WHERE id=usd;
  RAISE EXCEPTION 'TEST FAIL: vault currency changed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  DELETE FROM budget.tauxiliar WHERE id=bob;
  RAISE EXCEPTION 'TEST FAIL: journal history cascaded away';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  UPDATE budget.ttransaction SET amount=1 WHERE vault_request_id=req;
  RAISE EXCEPTION 'TEST FAIL: transfer editable';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f_create_saving_vault(home,gen_random_uuid(),'Unsupported','EUR');
  RAISE EXCEPTION 'TEST FAIL: unsupported currency accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 -- Two native currencies in one header remain invalid, even with a vault auxiliar.
 BEGIN
  INSERT INTO budget.ttransaction(household_id,type,amount,currency) VALUES(home,'transfer',1,'BOB') RETURNING id INTO tx;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base)
  SELECT tx,vault_account_id,id,'Bad USD account in BOB journal',1,0 FROM budget.tauxiliar WHERE id=usd;
  RAISE EXCEPTION 'TEST FAIL: mixed-currency line accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 FOR tx IN SELECT id FROM budget.ttransaction WHERE household_id=home LOOP PERFORM budget.f_check_journal(tx); END LOOP;
 PERFORM set_config('test.vault_actor',actor::text,true); PERFORM set_config('test.vault_home',home::text,true);
 INSERT INTO auth.users(id,email) VALUES(outsider,outsider||'@test.invalid');
 SELECT household_id INTO otherhome FROM budget.thousehold_member WHERE user_id=outsider;
 SELECT id INTO othercash FROM budget.taccount WHERE household_id=otherhome AND code='110';
 BEGIN
  PERFORM public.f_transfer_saving_vault(home,gen_random_uuid(),jsonb_build_object('kind','operating','id',othercash),jsonb_build_object('kind','vault','id',usd),1,1,1);
  RAISE EXCEPTION 'TEST FAIL: cross-household account accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 BEGIN
  PERFORM public.f_saving_vaults(home);
  RAISE EXCEPTION 'TEST FAIL: outsider report allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 -- USD/BRL/CNY households post native deposits without artificial conversion.
 FOR curr IN SELECT unnest(ARRAY['USD','BRL','CNY']) LOOP
  outsider:=gen_random_uuid(); INSERT INTO auth.users(id,email) VALUES(outsider,outsider||'@test.invalid');
  SELECT household_id,auxiliar_id INTO otherhome,aux FROM budget.thousehold_member WHERE user_id=outsider;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  UPDATE budget.thousehold SET currency=curr WHERE id=otherhome;
  SELECT id INTO othercash FROM budget.taccount WHERE household_id=otherhome AND code='110';
  SELECT id INTO capital FROM budget.taccount WHERE household_id=otherhome AND code='310';
  INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book) VALUES(otherhome,'opening_balance',1000,curr,'operating') RETURNING id INTO tx;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,othercash,aux,'Initial cash',1000,0),(tx,capital,aux,'Opening',0,1000);
  bob:=public.f_create_saving_vault(otherhome,gen_random_uuid(),'Native vault',curr);
  PERFORM public.f_transfer_saving_vault(otherhome,gen_random_uuid(),jsonb_build_object('kind','operating','id',othercash),jsonb_build_object('kind','vault','id',bob),300,300);
  IF (SELECT a.currency FROM budget.taccount a JOIN budget.tauxiliar x ON x.vault_account_id=a.id WHERE x.id=bob)<>curr
  OR budget.f_operating_available(otherhome,othercash)<>700 OR budget.f_vault_balance(bob)<>300 THEN RAISE EXCEPTION 'Wrong native vault currency or balance'; END IF;
 END LOOP;
 BEGIN
  INSERT INTO budget.ttransaction(household_id,type,amount,currency,household_currency_at_posting,household_fx_rate) VALUES(otherhome,'transfer',1,curr,'BOB',NULL);
  RAISE EXCEPTION 'TEST FAIL: incomplete rate snapshot allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO budget.ttransaction(household_id,type,amount,currency,vault_request_id,vault_leg) VALUES(otherhome,'transfer',1,curr,gen_random_uuid(),NULL);
  RAISE EXCEPTION 'TEST FAIL: incomplete transfer identity allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST FAIL:%' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: native/USD vault accounts and auxiliars, empty creation, deposits/releases, cross-currency linked postings, vault transfers, conserved funds, snapshots, retries, overspend, FX, immutability and currency isolation';
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 IF EXISTS(SELECT 1 FROM budget.tauxiliar WHERE vault_account_id IS NOT NULL) THEN RAISE EXCEPTION 'Vault auxiliar leaked to outsider'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.vault_actor'),true);
 IF (SELECT count(*) FROM budget.tauxiliar WHERE vault_account_id IS NOT NULL)<>3 THEN RAISE EXCEPTION 'Own vaults not visible'; END IF;
 IF has_function_privilege('anon','public.f_transfer_saving_vault(uuid,uuid,jsonb,jsonb,numeric,numeric,numeric,text,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous transfers allowed'; END IF;
 RAISE NOTICE 'PASS: vault auxiliar RLS and anonymous RPC denial';
END $$;
RESET ROLE;
ROLLBACK;
