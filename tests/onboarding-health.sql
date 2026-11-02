\set ON_ERROR_STOP on
-- Reversible checks for health opt-in and the supermarket food budget.
BEGIN;
DO $$
DECLARE
  actor UUID := gen_random_uuid(); outsider UUID := gen_random_uuid();
  home UUID; prefs JSONB; sug JSONB; food JSONB; n INT; v_currency TEXT;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Health opt-in test"}');
  SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=actor;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);

  -- One key merges; a second key must keep the first.
  prefs := public.f_set_household_preference(home,'health_opt_in','true');
  IF prefs->>'health_opt_in' <> 'true' THEN RAISE EXCEPTION 'health_opt_in not stored: %', prefs; END IF;
  prefs := public.f_set_household_preference(home,'tour_seen','false');
  IF prefs->>'health_opt_in' <> 'true' OR prefs->>'tour_seen' <> 'false' THEN RAISE EXCEPTION 'Preference merge lost a key: %', prefs; END IF;
  BEGIN
    PERFORM public.f_set_household_preference(home,'Bad Key','true');
    RAISE EXCEPTION 'Expected invalid key';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Invalid preference key' THEN RAISE; END IF; END;

  SELECT trim(currency) INTO STRICT v_currency FROM budget.thousehold WHERE id=home;
  INSERT INTO budget.tincome_source(household_id,name,estimated_amount,currency,frequency)
  VALUES (home,'Sueldo',10000,v_currency,'monthly');
  PERFORM public.f_select_household_pyramid(home,'f8505c97-2cac-4184-ad23-72c9d5086e02','{"needs":50,"debts":15,"personal":15,"saving":20}');
  sug := public.f_food_budget_suggestion(home);
  IF (sug->>'monthly_income')::numeric <> 10000
     OR (sug->>'needs_percentage')::numeric <> 50
     OR (sug->>'needs_amount')::numeric <> 5000
     OR (sug->>'suggested_monthly')::numeric <> 2000
     OR (sug->>'current_limit' IS NOT NULL AND (sug->>'current_limit')::numeric <> 0)
  THEN RAISE EXCEPTION 'Wrong food suggestion: %', sug; END IF;

  food := public.f_set_food_budget(home, 2000);
  IF (food->>'monthly_budget')::numeric <> 2000 THEN RAISE EXCEPTION 'monthly_budget not 2000: %', food; END IF;
  IF (public.f_get_family_health_context(home)->'food'->>'monthly_budget')::numeric <> 2000 THEN
    RAISE EXCEPTION 'Health context food budget not 2000: %', public.f_get_family_health_context(home)->'food';
  END IF;
  food := public.f_set_food_budget(home, 2500);
  SELECT count(*) INTO n FROM budget.tbudget b
    JOIN budget.tbudget_type bt ON bt.id = b.budget_type_id
   WHERE b.household_id = home AND bt.category_key = 'supermarket_groceries';
  IF n <> 1 OR (food->>'monthly_budget')::numeric <> 2500 THEN RAISE EXCEPTION 'Food budget upsert failed: rows % payload %', n, food; END IF;
  BEGIN
    PERFORM public.f_set_food_budget(home, -1);
    RAISE EXCEPTION 'Expected invalid limit';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Invalid monthly limit' THEN RAISE; END IF; END;

  -- Another authenticated user, not a member of this household.
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(outsider,outsider||'@test.invalid','{"full_name":"Outsider"}');
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN PERFORM public.f_set_household_preference(home,'health_opt_in','true'); RAISE EXCEPTION 'Expected preference denial';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Only a household administrator can change preferences' THEN RAISE; END IF; END;
  BEGIN PERFORM public.f_food_budget_suggestion(home); RAISE EXCEPTION 'Expected suggestion denial';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Household access denied' THEN RAISE; END IF; END;
  BEGIN PERFORM public.f_set_food_budget(home, 2000); RAISE EXCEPTION 'Expected budget denial';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Only a household administrator can set budgets' THEN RAISE; END IF; END;

  RAISE NOTICE 'PASS: preference merge, food suggestion, food budget upsert, access';
END $$;
ROLLBACK;
