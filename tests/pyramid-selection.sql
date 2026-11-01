\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); other_actor UUID:=gen_random_uuid(); home UUID; other_home UUID;
 template UUID:='f8505c97-2cac-4184-ad23-72c9d5086e02'; chosen UUID; repeated UUID; before_transactions BIGINT;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor::text||'@test.invalid','{"full_name":"Pyramid selection test"}');
 SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT count(*) INTO before_transactions FROM budget.ttransaction;
 chosen:=public.f_select_household_pyramid(home,template,'{"needs":50,"debts":15,"personal":15,"saving":20}');
 IF (SELECT financial_pyramid_id FROM budget.thousehold WHERE id=home)<>chosen THEN RAISE EXCEPTION 'Selected pyramid not persisted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.tfinancial_pyramid WHERE id=chosen AND household_id=home AND source_template_id=template) THEN RAISE EXCEPTION 'Template was not copied'; END IF;
 IF (SELECT sum(min_percentage) FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=chosen)<>100 THEN RAISE EXCEPTION 'Incorrect saved total'; END IF;
 repeated:=public.f_select_household_pyramid(home,template,'{"needs":60,"debts":10,"personal":10,"saving":20}',true);
 IF repeated<>chosen OR (SELECT count(*) FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=chosen)<>4 THEN RAISE EXCEPTION 'Repeated selection duplicated pyramid/levels'; END IF;
 IF (SELECT min_percentage FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=template AND code='needs')<>50 THEN RAISE EXCEPTION 'Global template modified'; END IF;
 IF EXISTS(SELECT 1 FROM budget.tbudget_type_pyramid_level m JOIN budget.tfinancial_pyramid_level l ON l.id=m.financial_pyramid_level_id JOIN budget.tbudget_type b ON b.id=m.budget_type_id WHERE l.financial_pyramid_id=chosen AND b.household_id IS DISTINCT FROM home) THEN RAISE EXCEPTION 'Category mappings crossed households'; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.tbudget_type_pyramid_level m JOIN budget.tfinancial_pyramid_level l ON l.id=m.financial_pyramid_level_id JOIN budget.tbudget_type b ON b.id=m.budget_type_id WHERE l.financial_pyramid_id=chosen AND l.code='saving' AND b.category_key='savings_investments') THEN RAISE EXCEPTION 'Savings category not mapped'; END IF;
 BEGIN
  PERFORM public.f_select_household_pyramid(home,template,'{"needs":50,"debts":15,"personal":15,"saving":19}');
  RAISE EXCEPTION 'Expected invalid total rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected invalid total rejection' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f_select_household_pyramid(home,template,'{"needs":50,"debts":15,"personal":15,"other":20}');
  RAISE EXCEPTION 'Expected incorrect level rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected incorrect level rejection' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f_select_household_pyramid(home,template,'{"needs":-10,"debts":10,"personal":80,"saving":20}');
  RAISE EXCEPTION 'Expected negative percentage rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected negative percentage rejection' THEN RAISE; END IF; END;
 PERFORM public.f_select_household_pyramid(home,template,'{"needs":33.33,"debts":10,"personal":23.33,"saving":33.34}',true);
 IF (SELECT count(*) FROM budget.ttransaction)<>before_transactions THEN RAISE EXCEPTION 'Plan generated accounting entries'; END IF;
 IF NOT (SELECT customized FROM budget.tfinancial_pyramid WHERE id=chosen) THEN RAISE EXCEPTION 'Custom flag not saved'; END IF;
 BEGIN
  PERFORM public.f_select_household_pyramid(home,template,'{"needs":60,"debts":10,"personal":10,"saving":20}');
  RAISE EXCEPTION 'Expected preset edit rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected preset edit rejection' THEN RAISE; END IF; END;
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(other_actor,other_actor::text||'@test.invalid','{"full_name":"Other pyramid test"}');
 SELECT household_id INTO STRICT other_home FROM budget.thousehold_member WHERE user_id=other_actor;
 PERFORM set_config('request.jwt.claim.sub',other_actor::text,true);
 BEGIN
  PERFORM public.f_select_household_pyramid(home,template,'{"needs":50,"debts":15,"personal":15,"saving":20}');
  RAISE EXCEPTION 'Expected cross-household rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected cross-household rejection' THEN RAISE; END IF; END;
 PERFORM set_config('test.pyramid_private',chosen::text,true);
 RAISE NOTICE 'PASS: selection, custom percentages, decimal 100%%, persisted pointer, templates unchanged, category mappings, no accounting impact';
END; $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM budget.tfinancial_pyramid WHERE id=current_setting('test.pyramid_private')::uuid)
 OR EXISTS(SELECT 1 FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=current_setting('test.pyramid_private')::uuid) THEN RAISE EXCEPTION 'Private pyramid exposed'; END IF;
 IF (SELECT count(*) FROM budget.tfinancial_pyramid WHERE household_id IS NULL AND selectable_template)<>3 THEN RAISE EXCEPTION 'Global templates unavailable'; END IF;
 UPDATE budget.tfinancial_pyramid_level SET min_percentage=99 WHERE financial_pyramid_id='f8505c97-2cac-4184-ad23-72c9d5086e02';
 IF FOUND THEN RAISE EXCEPTION 'Client edited global template'; END IF;
 RAISE NOTICE 'PASS: household isolation and read-only global templates';
END; $$;
RESET ROLE;
ROLLBACK;
