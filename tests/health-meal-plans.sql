\set ON_ERROR_STOP on
-- Reversible checks for family health profiles and weekly meal plans.
BEGIN;
DO $$
DECLARE
  actor UUID := gen_random_uuid(); home UUID; me UUID; kid UUID; r JSONB; plan JSONB; n INT; limited INT;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Health test"}');
  SELECT household_id,id INTO STRICT home,me FROM budget.thousehold_member WHERE user_id=actor;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  kid := public.f_add_household_member(home,'Lucas','son');

  -- Context lists both members without profiles.
  r := public.f_get_family_health_context(home);
  IF jsonb_array_length(r->'members')<>2 OR (r->'members'->0->>'has_profile')::boolean THEN RAISE EXCEPTION 'Wrong members: %',r->'members'; END IF;

  -- Profile upsert cleans tags and keeps untouched fields.
  r := public.f_upsert_member_health_profile(kid,'{"birth_year":2013,"allergies":[" Maní ","maní",""],"activities":["Fútbol"],"activity_level":"high"}');
  IF r->'allergies'<>'["maní"]'::jsonb OR r->'activities'<>'["fútbol"]'::jsonb THEN RAISE EXCEPTION 'Tags not cleaned: %',r; END IF;
  r := public.f_upsert_member_health_profile(kid,'{"likes":["pasta"]}');
  IF r->>'birth_year'<>'2013' OR r->'allergies'<>'["maní"]'::jsonb THEN RAISE EXCEPTION 'Partial update lost fields: %',r; END IF;
  BEGIN PERFORM public.f_upsert_member_health_profile(kid,'{"activity_level":"extreme"}'); RAISE EXCEPTION 'Expected check failure';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected check failure' THEN RAISE; END IF; END;
  r := public.f_get_family_health_context(home);
  IF (SELECT (m->>'age')::int FROM jsonb_array_elements(r->'members') m WHERE m->>'member_id'=kid::text) <> extract(year FROM now())::int-2013 THEN RAISE EXCEPTION 'Age missing'; END IF;

  -- Valid plan: cost = sum of shopping list.
  plan := '{"summary":"Semana simple","days":[{"day":"Lunes","meals":[{"type":"lunch","name":"Arroz con pollo","ingredients":["arroz","pollo"],"cost":30}]}],
            "shopping_list":[{"item":"Arroz","quantity":"1 kg","cost":12.5},{"item":"Pollo","quantity":"1 kg","cost":30}],
            "activities":[{"name":"Fútbol en el parque","for":"Lucas","cost":0,"why":"Le gusta"}]}';
  r := public.f_save_meal_plan(home,'2026-11-02',plan,100,'barato');
  IF (r->>'estimated_cost')::numeric<>42.5 OR NOT (r->>'within_budget')::boolean THEN RAISE EXCEPTION 'Wrong cost: %',r; END IF;
  -- Same week again replaces the active plan.
  r := public.f_save_meal_plan(home,'2026-11-02',plan,40,NULL);
  SELECT count(*) INTO n FROM budget.tmeal_plan WHERE household_id=home AND status='active';
  IF n<>1 OR (r->>'within_budget')::boolean THEN RAISE EXCEPTION 'Replace or budget flag failed: % %',n,r; END IF;
  IF public.f_get_meal_plan(home)->>'id' <> r->>'id' THEN RAISE EXCEPTION 'Latest plan not returned'; END IF;

  -- Allergen anywhere in the plan is refused.
  BEGIN
    PERFORM public.f_save_meal_plan(home,'2026-11-02',jsonb_set(plan,'{shopping_list,0,item}','"Maní tostado"'));
    RAISE EXCEPTION 'Expected allergen failure';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'allergen_conflict%' THEN RAISE; END IF; END;
  -- Malformed plans are refused.
  BEGIN PERFORM public.f_save_meal_plan(home,NULL,'{"days":[]}'); RAISE EXCEPTION 'Expected shape failure';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected shape failure' THEN RAISE; END IF; END;

  -- Food budget: suggested weekly amount from the remaining monthly limit.
  UPDATE budget.tbudget b SET monthly_limit=800 FROM budget.tbudget_type bt
   WHERE bt.id=b.budget_type_id AND b.household_id=home AND bt.category_key='supermarket_groceries';
  GET DIAGNOSTICS limited = ROW_COUNT;
  IF limited>0 THEN
    r := public.f_get_family_health_context(home);
    IF (r->'food'->>'monthly_budget')::numeric<>800 OR (r->'food'->>'suggested_weekly')::numeric<=0 THEN RAISE EXCEPTION 'Food budget wrong: %',r->'food'; END IF;
  END IF;

  -- Service role (n8n) reads without a user; outsiders are denied.
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  IF public.f_get_family_health_context(home) IS NULL THEN RAISE EXCEPTION 'Service role denied'; END IF;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN PERFORM public.f_get_family_health_context(home); RAISE EXCEPTION 'Expected authorization failure';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected authorization failure' THEN RAISE; END IF; END;
  BEGIN PERFORM public.f_upsert_member_health_profile(kid,'{}'); RAISE EXCEPTION 'Expected authorization failure';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected authorization failure' THEN RAISE; END IF; END;

  RAISE NOTICE 'PASS: profiles (clean, partial, checks), plan cost/replace/budget flag, allergen guard, shape, food budget (%), service role, access', CASE WHEN limited>0 THEN 'checked' ELSE 'no budget row' END;
END $$;
ROLLBACK;
