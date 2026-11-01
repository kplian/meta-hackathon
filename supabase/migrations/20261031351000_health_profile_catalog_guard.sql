-- =====================================================================
-- Profile catalog and whole-word safety guard.
-- Depends on 20261031350000 (budget.thealth_option, budget.f_norm_text).
-- Maps free text to catalog codes, forbids hard conditions and the
-- allergens they imply, and matches keywords as whole words.
-- =====================================================================

ALTER TABLE budget.tmember_health_profile
  ADD COLUMN conditions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN weight_kg NUMERIC(5,1),
  ADD COLUMN height_cm NUMERIC(5,1),
  ADD CONSTRAINT tmember_health_profile_weight_check CHECK (weight_kg IS NULL OR weight_kg BETWEEN 2 AND 400),
  ADD CONSTRAINT tmember_health_profile_height_check CHECK (height_cm IS NULL OR height_cm BETWEEN 40 AND 250);

-- Catalog code when the value is a code, a keyword or a label in any language; otherwise the free text ("Otro").
CREATE OR REPLACE FUNCTION budget.f_map_codes(p_kind TEXT, p_values TEXT[])
RETURNS TEXT[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT COALESCE(o.code, v) ORDER BY COALESCE(o.code, v)), '{}')
    FROM unnest(COALESCE(p_values, '{}')) v
    LEFT JOIN budget.thealth_option o ON o.kind = p_kind AND (
         o.code = v OR budget.f_norm_text(v) = ANY (o.keywords)
         OR budget.f_norm_text(v) IN (budget.f_norm_text(o.labels->>'es'), budget.f_norm_text(o.labels->>'en'), budget.f_norm_text(o.labels->>'pt')));
$$;

-- First keyword mentioned in p_text as a whole word (optional plural s/es), after removing exclusion phrases.
-- Text and keywords are normalized with f_norm_text; every boundary becomes a single space.
CREATE OR REPLACE FUNCTION budget.f_text_mentions(p_text TEXT, p_keywords TEXT[], p_exclusions TEXT[])
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v TEXT := ' ' || budget.f_norm_text(p_text) || ' '; k TEXT;
BEGIN
    FOREACH k IN ARRAY COALESCE(p_exclusions, '{}') LOOP
        IF k <> '' THEN v := regexp_replace(v, ' ' || k || '(s|es)?(?= )', ' ', 'g'); END IF;
    END LOOP;
    FOREACH k IN ARRAY COALESCE(p_keywords, '{}') LOOP
        IF k <> '' AND v ~ (' ' || k || '(s|es)?(?= )') THEN RETURN k; END IF;
    END LOOP;
    RETURN NULL;
END $$;

-- Everything that may never appear in a plan of this household.
CREATE OR REPLACE FUNCTION budget.f_household_forbidden(p_household_id UUID)
RETURNS TABLE(code TEXT, keywords TEXT[], exclusions TEXT[]) LANGUAGE sql STABLE AS $$
  WITH prof AS (
    SELECT p.* FROM budget.thousehold_member m
    JOIN budget.tmember_health_profile p ON p.household_member_id = m.id
    WHERE m.household_id = p_household_id AND m.status = 'active' AND m.deleted_at IS NULL
  ), refs AS (
    SELECT 'allergen' AS kind, a AS code FROM prof, unnest(prof.allergies) a
    UNION SELECT 'diet', d FROM prof, unnest(prof.diet) d
    UNION SELECT 'condition', c FROM prof, unnest(prof.conditions) c
  )
  SELECT o.code::text, o.keywords, o.exclusions FROM refs r
    JOIN budget.thealth_option o ON o.kind = 'allergen' AND o.code = r.code WHERE r.kind = 'allergen'
  UNION
  SELECT r.code, ARRAY[budget.f_norm_text(r.code)], '{}'::text[] FROM refs r
   WHERE r.kind = 'allergen' AND length(budget.f_norm_text(r.code)) >= 3
     AND NOT EXISTS (SELECT 1 FROM budget.thealth_option o WHERE o.kind = 'allergen' AND o.code = r.code)
  UNION
  SELECT o.code::text, o.keywords, o.exclusions FROM refs r
    JOIN budget.thealth_option o ON o.kind = r.kind AND o.code = r.code WHERE o.hard AND r.kind <> 'allergen'
  UNION
  SELECT a.code::text, a.keywords, a.exclusions FROM refs r
    JOIN budget.thealth_option o ON o.kind = r.kind AND o.code = r.code
    JOIN budget.thealth_option a ON a.kind = 'allergen' AND a.code = o.implies_allergen;
$$;

-- Rules for the planner: forbidden keywords, per-condition prompt rules with the members concerned, labels of every code in use.
CREATE OR REPLACE FUNCTION budget.f_health_rules(p_household_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH prof AS (
    SELECT u.full_name AS name, p.* FROM budget.thousehold_member m
    JOIN budget.tuser u ON u.id = m.user_id
    LEFT JOIN budget.tmember_health_profile p ON p.household_member_id = m.id
    WHERE m.household_id = p_household_id AND m.status = 'active' AND m.deleted_at IS NULL
  ), refs AS (
    SELECT name, 'allergen' AS kind, a AS code FROM prof, unnest(prof.allergies) a
    UNION ALL SELECT name, 'diet', d FROM prof, unnest(prof.diet) d
    UNION ALL SELECT name, 'condition', c FROM prof, unnest(prof.conditions) c
    UNION ALL SELECT name, 'activity', x FROM prof, unnest(prof.activities) x
    UNION ALL SELECT name, 'goal', health_goal FROM prof WHERE health_goal IS NOT NULL
    UNION ALL SELECT name, 'activity_level', activity_level FROM prof WHERE activity_level IS NOT NULL
  ), used AS (
    SELECT o.* FROM (SELECT DISTINCT kind, code FROM refs) r JOIN budget.thealth_option o ON o.kind = r.kind AND o.code = r.code
    UNION
    SELECT a.* FROM (SELECT DISTINCT kind, code FROM refs) r JOIN budget.thealth_option o ON o.kind = r.kind AND o.code = r.code
      JOIN budget.thealth_option a ON a.kind = 'allergen' AND a.code = o.implies_allergen
  )
  SELECT jsonb_build_object(
    'forbidden', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', f.code, 'keywords', to_jsonb(f.keywords), 'exclusions', to_jsonb(f.exclusions)) ORDER BY f.code)
                            FROM budget.f_household_forbidden(p_household_id) f), '[]'::jsonb),
    'prompt_rules', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', o.kind, 'code', o.code, 'members', to_jsonb(g.members), 'rule', o.prompt_rule) ORDER BY o.kind, o.sort_order)
                            FROM (SELECT kind, code, array_agg(DISTINCT name) members FROM refs GROUP BY 1, 2) g
                            JOIN budget.thealth_option o ON o.kind = g.kind AND o.code = g.code WHERE o.prompt_rule IS NOT NULL), '[]'::jsonb),
    'labels', COALESCE((SELECT jsonb_object_agg(u.code, u.labels) FROM used u), '{}'::jsonb)
  );
$$;

-- =====================================================================
-- 1. Context for the agent / app: members, profiles, budgets, last plan
-- =====================================================================
CREATE OR REPLACE FUNCTION public.f_get_family_health_context(p_household_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = budget, public AS $$
DECLARE v_result JSONB;
BEGIN
    IF NOT budget.f_health_access(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
    SELECT jsonb_build_object(
        'household', jsonb_build_object('id', h.id, 'name', h.name, 'currency', trim(COALESCE(h.currency, 'BOB'))),
        'members', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'member_id', m.id, 'name', u.full_name, 'member_type', m.member_type, 'role', m.role,
                'birth_year', p.birth_year,
                'age', CASE WHEN p.birth_year IS NULL THEN NULL ELSE extract(year FROM now())::int - p.birth_year END,
                'allergies', COALESCE(to_jsonb(p.allergies), '[]'::jsonb),
                'diet', COALESCE(to_jsonb(p.diet), '[]'::jsonb),
                'likes', COALESCE(to_jsonb(p.likes), '[]'::jsonb),
                'dislikes', COALESCE(to_jsonb(p.dislikes), '[]'::jsonb),
                'activity_level', p.activity_level,
                'activities', COALESCE(to_jsonb(p.activities), '[]'::jsonb),
                'health_goal', p.health_goal,
                'notes', p.notes,
                'conditions', COALESCE(to_jsonb(p.conditions), '[]'::jsonb),
                'weight_kg', p.weight_kg,
                'height_cm', p.height_cm,
                'has_profile', p.id IS NOT NULL
            ) ORDER BY m.role = 'admin' DESC, m.created_at)
              FROM budget.thousehold_member m
              JOIN budget.tuser u ON u.id = m.user_id
              LEFT JOIN budget.tmember_health_profile p ON p.household_member_id = m.id
             WHERE m.household_id = h.id AND m.status = 'active' AND m.deleted_at IS NULL
        ), '[]'::jsonb),
        'food', budget.f_category_month_status(h.id, ARRAY['supermarket_groceries']),
        'eating_out', budget.f_category_month_status(h.id, ARRAY['restaurants_leisure']),
        'health', budget.f_category_month_status(h.id, ARRAY['health_pharmacy']),
        'latest_meal_plan', (
            SELECT jsonb_build_object('id', mp.id, 'week_start', mp.week_start, 'estimated_cost', mp.estimated_cost,
                                      'budget_amount', mp.budget_amount, 'created_at', mp.created_at)
              FROM budget.tmeal_plan mp
             WHERE mp.household_id = h.id AND mp.status = 'active'
             ORDER BY mp.week_start DESC, mp.created_at DESC LIMIT 1
        ),
        'rules', budget.f_health_rules(h.id)
    ) INTO v_result
      FROM budget.thousehold h
     WHERE h.id = p_household_id AND h.deleted_at IS NULL;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Household not found'; END IF;
    RETURN v_result;
END $$;

-- =====================================================================
-- 2. Create or update one member's profile (household admin or n8n).
--    Only the keys present in p_profile are changed.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.f_upsert_member_health_profile(p_member_id UUID, p_profile JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = budget, public AS $$
DECLARE
    v_household UUID;
    v_row budget.tmember_health_profile;
BEGIN
    SELECT household_id INTO v_household FROM budget.thousehold_member
     WHERE id = p_member_id AND status = 'active' AND deleted_at IS NULL;
    IF v_household IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
    IF NOT budget.f_health_access(v_household, true) THEN RAISE EXCEPTION 'Only a household administrator can edit health profiles'; END IF;
    IF p_profile IS NULL OR jsonb_typeof(p_profile) <> 'object' THEN RAISE EXCEPTION 'Profile must be an object'; END IF;

    INSERT INTO budget.tmember_health_profile (household_member_id, created_by)
    VALUES (p_member_id, auth.uid())
    ON CONFLICT (household_member_id) DO NOTHING;

    SELECT * INTO v_row FROM budget.tmember_health_profile WHERE household_member_id = p_member_id FOR UPDATE;

    IF p_profile ? 'birth_year' THEN v_row.birth_year := NULLIF(p_profile->>'birth_year', '')::int; END IF;
    IF p_profile ? 'allergies' THEN v_row.allergies := budget.f_map_codes('allergen', budget.f_clean_tags(p_profile->'allergies')); END IF;
    IF p_profile ? 'diet' THEN v_row.diet := budget.f_map_codes('diet', budget.f_clean_tags(p_profile->'diet')); END IF;
    IF p_profile ? 'likes' THEN v_row.likes := budget.f_clean_tags(p_profile->'likes'); END IF;
    IF p_profile ? 'dislikes' THEN v_row.dislikes := budget.f_clean_tags(p_profile->'dislikes'); END IF;
    IF p_profile ? 'activities' THEN v_row.activities := budget.f_map_codes('activity', budget.f_clean_tags(p_profile->'activities')); END IF;
    IF p_profile ? 'activity_level' THEN v_row.activity_level := NULLIF(lower(trim(p_profile->>'activity_level')), ''); END IF;
    IF p_profile ? 'health_goal' THEN v_row.health_goal := NULLIF(lower(trim(p_profile->>'health_goal')), ''); END IF;
    IF p_profile ? 'notes' THEN v_row.notes := NULLIF(trim(p_profile->>'notes'), ''); END IF;
    IF p_profile ? 'conditions' THEN v_row.conditions := budget.f_map_codes('condition', budget.f_clean_tags(p_profile->'conditions')); END IF;
    IF p_profile ? 'weight_kg' THEN v_row.weight_kg := NULLIF(p_profile->>'weight_kg', '')::numeric; END IF;
    IF p_profile ? 'height_cm' THEN v_row.height_cm := NULLIF(p_profile->>'height_cm', '')::numeric; END IF;

    UPDATE budget.tmember_health_profile SET
        birth_year = v_row.birth_year, allergies = v_row.allergies, diet = v_row.diet,
        likes = v_row.likes, dislikes = v_row.dislikes, activities = v_row.activities,
        activity_level = v_row.activity_level, health_goal = v_row.health_goal, notes = v_row.notes,
        conditions = v_row.conditions, weight_kg = v_row.weight_kg, height_cm = v_row.height_cm,
        updated_at = now(), updated_by = auth.uid()
     WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
        'member_id', p_member_id, 'birth_year', v_row.birth_year, 'allergies', to_jsonb(v_row.allergies),
        'diet', to_jsonb(v_row.diet), 'likes', to_jsonb(v_row.likes), 'dislikes', to_jsonb(v_row.dislikes),
        'activity_level', v_row.activity_level, 'activities', to_jsonb(v_row.activities),
        'health_goal', v_row.health_goal, 'notes', v_row.notes,
        'conditions', to_jsonb(v_row.conditions), 'weight_kg', v_row.weight_kg, 'height_cm', v_row.height_cm);
END $$;

-- =====================================================================
-- 3. Save a weekly plan. Shape:
--    days: [{ day, meals: [{ type, name, ingredients: [..], cost, for? }] }]
--    shopping_list: [{ item, quantity, cost }]
--    activities: [{ name, for, cost, why }]
--    estimated_cost = sum of shopping_list costs. Replaces the active plan
--    for the same week. Rejects plans that mention a forbidden term.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.f_save_meal_plan(
    p_household_id UUID,
    p_week_start DATE,
    p_plan JSONB,
    p_budget NUMERIC DEFAULT NULL,
    p_user_request TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'ai',
    p_model TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = budget, public AS $$
DECLARE
    v_currency TEXT;
    v_days JSONB := p_plan->'days';
    v_shopping JSONB := COALESCE(p_plan->'shopping_list', '[]'::jsonb);
    v_activities JSONB := COALESCE(p_plan->'activities', '[]'::jsonb);
    v_week DATE := COALESCE(p_week_start, (date_trunc('week', now()))::date);
    v_cost NUMERIC;
    v_text TEXT;
    v_conflict TEXT;
    v_id UUID;
BEGIN
    IF NOT budget.f_health_access(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
    SELECT trim(COALESCE(currency, 'BOB')) INTO v_currency FROM budget.thousehold WHERE id = p_household_id AND deleted_at IS NULL;
    IF v_currency IS NULL THEN RAISE EXCEPTION 'Household not found'; END IF;

    IF v_days IS NULL OR jsonb_typeof(v_days) <> 'array' OR jsonb_array_length(v_days) NOT BETWEEN 1 AND 7 THEN
        RAISE EXCEPTION 'Plan must contain between 1 and 7 days';
    END IF;
    IF jsonb_typeof(v_shopping) <> 'array' OR jsonb_typeof(v_activities) <> 'array' THEN
        RAISE EXCEPTION 'shopping_list and activities must be lists';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_days) d
         WHERE jsonb_typeof(d->'meals') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'meals') = 0
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(d->'meals') m WHERE NULLIF(trim(m->>'name'), '') IS NULL)
    ) THEN
        RAISE EXCEPTION 'Every day needs at least one named meal';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_shopping) s
         WHERE NULLIF(trim(s->>'item'), '') IS NULL
            OR jsonb_typeof(s->'cost') IS DISTINCT FROM 'number' OR (s->>'cost')::numeric < 0
    ) THEN
        RAISE EXCEPTION 'Every shopping item needs a name and a non-negative cost';
    END IF;

    -- Hard safety guard: whole word, after exclusions, including implied allergens.
    v_text := v_days::text || ' ' || v_shopping::text;
    SELECT f.code INTO v_conflict FROM budget.f_household_forbidden(p_household_id) f
     WHERE budget.f_text_mentions(v_text, f.keywords, f.exclusions) IS NOT NULL
     ORDER BY f.code LIMIT 1;
    IF v_conflict IS NOT NULL THEN RAISE EXCEPTION 'allergen_conflict: %', v_conflict; END IF;

    SELECT COALESCE(SUM((s->>'cost')::numeric), 0) INTO v_cost FROM jsonb_array_elements(v_shopping) s;

    UPDATE budget.tmeal_plan SET status = 'replaced'
     WHERE household_id = p_household_id AND week_start = v_week AND status = 'active';

    INSERT INTO budget.tmeal_plan (household_id, week_start, currency, budget_amount, estimated_cost, days,
                                   shopping_list, activities, summary, user_request, source, model, created_by)
    VALUES (p_household_id, v_week, v_currency, p_budget, round(v_cost, 2), v_days, v_shopping, v_activities,
            left(NULLIF(trim(p_plan->>'summary'), ''), 1000), left(NULLIF(trim(p_user_request), ''), 500),
            COALESCE(p_source, 'ai'), left(p_model, 120), auth.uid())
    RETURNING id INTO v_id;

    RETURN public.f_get_meal_plan(p_household_id, v_week);
END $$;

UPDATE budget.tmember_health_profile
   SET allergies = budget.f_map_codes('allergen', allergies),
       diet = budget.f_map_codes('diet', diet),
       activities = budget.f_map_codes('activity', activities);

REVOKE ALL ON FUNCTION budget.f_map_codes(TEXT, TEXT[]), budget.f_text_mentions(TEXT, TEXT[], TEXT[]), budget.f_household_forbidden(UUID), budget.f_health_rules(UUID) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
