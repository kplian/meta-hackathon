-- Model-only verification: no FX fetching, yield accrual or alerts.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); home UUID; pos UUID; crypto UUID; request UUID:=gen_random_uuid();
 count_before BIGINT; original_values NUMERIC; old_preferences JSONB; currency_code TEXT;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor::text||'@test.invalid','{"full_name":"Units and yield test"}');
 SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 FOREACH currency_code IN ARRAY ARRAY['BOB','BRL','CNY','EUR'] LOOP
  request:=gen_random_uuid();
  pos:=public.f_register_household_asset(home,'savings','Ahorro de prueba',5000,0.2,'estimated_value',request,
   p_unit_code:=currency_code,p_rate_source:='manual test rate, not a market quote',p_rate_as_of:=now(),p_institution:='Banco de prueba',
   p_yield_settings:='{"enabled":true,"yield_kind":"interest","reminder_enabled":true,"reminder_day":31,"timezone":"America/La_Paz"}');
  IF NOT EXISTS(SELECT 1 FROM budget.vasset_current_value WHERE id=pos AND quantity=5000 AND unit_code=currency_code AND unit_kind='fiat' AND currency='USD' AND opening_value_usd=1000) THEN RAISE EXCEPTION 'Original currency or USD value lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM budget.tasset_yield_settings WHERE position_id=pos AND enabled AND yield_kind='interest' AND reminder_enabled AND reminder_day=31 AND notify_user_id=actor) THEN RAISE EXCEPTION 'Monthly preferences not saved'; END IF;
  IF public.f_register_household_asset(home,'savings','Ahorro de prueba',5000,0.2,'estimated_value',request,
   p_unit_code:=currency_code,p_rate_source:='manual test rate, not a market quote',p_rate_as_of:=now(),p_institution:='Banco de prueba',
   p_yield_settings:='{"enabled":true,"yield_kind":"interest","reminder_enabled":true,"reminder_day":31,"timezone":"America/La_Paz"}')<>pos THEN RAISE EXCEPTION 'Duplicate registration'; END IF;
 END LOOP;
 BEGIN
  PERFORM public.f_register_household_asset(home,'savings','Ahorro de prueba',5000,0.2,'estimated_value',request,
   p_unit_code:='GBP',p_rate_source:='manual test rate, not a market quote',p_rate_as_of:=now());
  RAISE EXCEPTION 'Expected original currency retry rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected original currency retry rejection' THEN RAISE; END IF; END;
 pos:=public.f_register_household_asset(home,'term_deposit','Depósito en USD',1000,1,'estimated_value',gen_random_uuid(),
  p_unit_code:='USD',p_institution:='Banco de prueba',p_maturity_date:=current_date+365);
 IF NOT EXISTS(SELECT 1 FROM budget.tasset_position WHERE id=pos AND unit_code='USD' AND opening_value_usd=1000 AND maturity_date=current_date+365) THEN RAISE EXCEPTION 'USD term deposit incorrect'; END IF;
 IF EXISTS(SELECT 1 FROM budget.tasset_yield_settings WHERE position_id=pos AND enabled) THEN RAISE EXCEPTION 'Interest implicitly enabled'; END IF;
 BEGIN
  PERFORM public.f_register_household_asset(home,'cash','USD incorrecto',100,0.8,'estimated_value',gen_random_uuid(),p_unit_code:='USD');
  RAISE EXCEPTION 'Expected identity rate rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected identity rate rejection' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f_register_household_asset(home,'savings','Sin procedencia',100,0.2,'estimated_value',gen_random_uuid(),p_unit_code:='BOB');
  RAISE EXCEPTION 'Expected rate provenance rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected rate provenance rejection' THEN RAISE; END IF; END;
 pos:=public.f_register_household_asset(home,'savings','Cambio online',5000,0.125,'estimated_value',gen_random_uuid(),
  p_unit_code:='BOB',p_rate_source:='twelve_data',p_rate_as_of:='2026-10-30 12:00:00+00');
 IF NOT EXISTS(SELECT 1 FROM budget.tasset_position WHERE id=pos AND quantity=5000 AND opening_value_usd=625
  AND initial_rate_source='twelve_data' AND initial_rate_as_of='2026-10-30 12:00:00+00') THEN RAISE EXCEPTION 'Online FX provenance not saved'; END IF;
 pos:=public.f_register_household_asset(home,'bond','Bono manual',10,100,'estimated_value',gen_random_uuid());
 IF (SELECT unit_code FROM budget.tasset_position WHERE id=pos)<>'UNIT' THEN RAISE EXCEPTION 'Manual bond registration regressed'; END IF;
 crypto:=public.f_register_household_asset(home,'crypto','Solana',5,100,'purchase_price',gen_random_uuid(),p_symbol:='SOL/USD',
  p_yield_settings:='{"enabled":true,"yield_kind":"rewards","reminder_enabled":false}');
 IF NOT EXISTS(SELECT 1 FROM budget.tasset_position WHERE id=crypto AND quantity=5 AND unit_kind='crypto' AND unit_code='SOL' AND opening_value_usd=500) THEN RAISE EXCEPTION 'Crypto original units lost'; END IF;
 SELECT count(*) INTO count_before FROM budget.ttransaction;
 SELECT row_to_json(y)::jsonb INTO old_preferences FROM budget.tasset_yield_settings y WHERE position_id=crypto;
 BEGIN
  PERFORM public.f_configure_asset_yield(crypto,true,'rewards',true,32::smallint,'UTC');
  RAISE EXCEPTION 'Expected invalid reminder day rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected invalid reminder day rejection' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f_configure_asset_yield(crypto,true,'rewards',true,1::smallint,'Invalid/Timezone');
  RAISE EXCEPTION 'Expected invalid timezone rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected invalid timezone rejection' THEN RAISE; END IF; END;
 PERFORM public.f_configure_asset_yield(crypto,true,'both',true,15::smallint,'Asia/Shanghai');
 PERFORM public.f_configure_asset_yield(crypto,false);
 IF EXISTS(SELECT 1 FROM budget.tasset_yield_settings WHERE position_id=crypto AND (enabled OR reminder_enabled OR notify_user_id IS NOT NULL OR reminder_day IS NOT NULL)) THEN RAISE EXCEPTION 'Disable did not clear reminder preferences'; END IF;
 IF (SELECT count(*) FROM budget.ttransaction)<>count_before OR (SELECT quantity FROM budget.tasset_position WHERE id=crypto)<>5 THEN RAISE EXCEPTION 'Preference generated yield postings or quantities'; END IF;
 -- Invalid preferences must roll back the opening, auxiliar and position atomically.
 request:=gen_random_uuid();
 BEGIN
  PERFORM public.f_register_household_asset(home,'cash','Invalid prefs',10,1,'estimated_value',request,p_unit_code:='USD',
   p_yield_settings:='{"enabled":false,"reminder_enabled":true,"reminder_day":1}');
  RAISE EXCEPTION 'Expected inconsistent preference rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected inconsistent preference rejection' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM budget.tasset_position WHERE request_id=request) THEN RAISE EXCEPTION 'Failed registration left a position'; END IF;
 PERFORM set_config('test.yield_position',crypto::text,true);
 actor:=gen_random_uuid();
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor::text||'@test.invalid','{"full_name":"Outsider yield test"}');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 BEGIN
  PERFORM public.f_configure_asset_yield(crypto,true,'rewards');
  RAISE EXCEPTION 'Expected cross-household update rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected cross-household update rejection' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: original BOB/BRL/CNY/EUR and SOL units, USD openings, term deposit, preferences, opt-out, retries and atomicity';
END; $$;
SET CONSTRAINTS ALL IMMEDIATE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM budget.tasset_yield_settings WHERE position_id=current_setting('test.yield_position')::uuid) THEN RAISE EXCEPTION 'Cross-household preferences exposed'; END IF;
 RAISE NOTICE 'PASS: yield preferences are isolated by household';
END; $$;
RESET ROLE;
ROLLBACK;
