-- =====================================================================
-- Family health profiles and weekly meal plans.
-- Each household member can carry allergies, diet, tastes and physical
-- activity. The meal-plan Edge Function (Llama) reads the context below,
-- builds a weekly menu within the food budget and stores it here. n8n
-- calls the same RPCs with the service role key (WhatsApp channel).
-- Allergies are hard constraints: f_save_meal_plan refuses any plan whose
-- meals or shopping items mention a member's allergy.
-- =====================================================================

CREATE TABLE IF NOT EXISTS budget.tmember_health_profile (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_member_id UUID NOT NULL,
    birth_year INTEGER,
    allergies TEXT[] NOT NULL DEFAULT '{}',
    diet TEXT[] NOT NULL DEFAULT '{}',
    likes TEXT[] NOT NULL DEFAULT '{}',
    dislikes TEXT[] NOT NULL DEFAULT '{}',
    activity_level VARCHAR(15),
    activities TEXT[] NOT NULL DEFAULT '{}',
    health_goal VARCHAR(30),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    CONSTRAINT tmember_health_profile_pkey PRIMARY KEY (id),
    CONSTRAINT tmember_health_profile_member_key UNIQUE (household_member_id),
    CONSTRAINT tmember_health_profile_member_fkey FOREIGN KEY (household_member_id)
        REFERENCES budget.thousehold_member (id) ON DELETE CASCADE,
    CONSTRAINT tmember_health_profile_birth_year_check
        CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100),
    CONSTRAINT tmember_health_profile_activity_check
        CHECK (activity_level IS NULL OR activity_level IN ('low', 'moderate', 'high')),
    CONSTRAINT tmember_health_profile_goal_check
        CHECK (health_goal IS NULL OR health_goal IN ('maintain', 'eat_healthier', 'lose_weight', 'gain_muscle', 'more_energy')),
    CONSTRAINT tmember_health_profile_notes_check CHECK (notes IS NULL OR length(notes) <= 500)
);

CREATE TABLE IF NOT EXISTS budget.tmeal_plan (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    week_start DATE NOT NULL,
    currency VARCHAR(3) NOT NULL,
    budget_amount NUMERIC(14, 2),
    estimated_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
    days JSONB NOT NULL,
    shopping_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    activities JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT,
    user_request TEXT,
    source VARCHAR(15) NOT NULL DEFAULT 'ai',
    model VARCHAR(120),
    status VARCHAR(15) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    CONSTRAINT tmeal_plan_pkey PRIMARY KEY (id),
    CONSTRAINT tmeal_plan_household_fkey FOREIGN KEY (household_id)
        REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT tmeal_plan_source_check CHECK (source IN ('ai', 'manual')),
    CONSTRAINT tmeal_plan_status_check CHECK (status IN ('active', 'replaced')),
    CONSTRAINT tmeal_plan_days_check CHECK (jsonb_typeof(days) = 'array'),
    CONSTRAINT tmeal_plan_shopping_check CHECK (jsonb_typeof(shopping_list) = 'array'),
    CONSTRAINT tmeal_plan_activities_check CHECK (jsonb_typeof(activities) = 'array')
);
CREATE INDEX IF NOT EXISTS tmeal_plan_household_week_idx
    ON budget.tmeal_plan (household_id, week_start DESC, created_at DESC);

-- Only reachable through the SECURITY DEFINER functions below.
ALTER TABLE budget.tmember_health_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget.tmeal_plan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON budget.tmember_health_profile, budget.tmeal_plan FROM anon, authenticated;

-- Service role (n8n, Edge Function with service key) or a household member.
CREATE OR REPLACE FUNCTION budget.f_health_access(p_household_id UUID, p_write BOOLEAN DEFAULT false)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = budget, public AS $$
    SELECT COALESCE(auth.role(), '') = 'service_role'
        OR budget.f_is_household_member(p_household_id, p_write);
$$;
REVOKE ALL ON FUNCTION budget.f_health_access(UUID, BOOLEAN) FROM PUBLIC, anon;

-- Clean a free-text array: trimmed, lowercase, non-empty, unique, max 20 x 60 chars.
CREATE OR REPLACE FUNCTION budget.f_clean_tags(p_value JSONB)
RETURNS TEXT[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_result TEXT[];
BEGIN
    IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN RETURN '{}'; END IF;
    IF jsonb_typeof(p_value) <> 'array' THEN RAISE EXCEPTION 'Expected a list of values'; END IF;
    SELECT COALESCE(array_agg(DISTINCT v), '{}') INTO v_result
      FROM (SELECT lower(trim(x)) v FROM jsonb_array_elements_text(p_value) x) s
     WHERE v <> '';
    IF cardinality(v_result) > 20 OR EXISTS (SELECT 1 FROM unnest(v_result) v WHERE length(v) > 60) THEN
        RAISE EXCEPTION 'Too many values or value too long';
    END IF;
    RETURN v_result;
END $$;

-- Remaining budget for one category this month: limit, real spending, remaining.
CREATE OR REPLACE FUNCTION budget.f_category_month_status(p_household_id UUID, p_keys TEXT[])
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = budget, public AS $$
    WITH h AS (SELECT * FROM budget.thousehold WHERE id = p_household_id),
    lim AS (
        SELECT SUM(b.monthly_limit) amount
          FROM budget.tbudget b
          JOIN budget.tbudget_type bt ON bt.id = b.budget_type_id
         WHERE b.household_id = p_household_id AND b.deleted_at IS NULL
           AND b.monthly_limit > 0 AND bt.category_key = ANY (p_keys)
    ),
    spent AS (
        SELECT COALESCE(SUM(d.debit_base), 0) amount
          FROM budget.ttransaction t
          JOIN h ON h.id = t.household_id
          JOIN budget.ttransaction_detail d ON d.transaction_id = t.id AND d.deleted_at IS NULL
          JOIN budget.tbudget_type bt ON bt.id = d.budget_type_id
         WHERE t.type = 'expense' AND t.deleted_at IS NULL AND COALESCE(t.status, 'active') = 'active'
           AND COALESCE(t.ledger_book, 'operating') = 'operating'
           AND t.transaction_date >= date_trunc('month', now())
           AND t.transaction_date < date_trunc('month', now()) + interval '1 month'
           AND d.debit_base > 0 AND bt.category_key = ANY (p_keys)
    )
    SELECT jsonb_build_object(
        'monthly_budget', lim.amount,
        'spent_month', spent.amount,
        'remaining_month', CASE WHEN lim.amount IS NULL THEN NULL ELSE lim.amount - spent.amount END,
        -- Spread what is left over the remaining weeks of the month (at least one).
        'suggested_weekly', CASE WHEN lim.amount IS NULL THEN NULL ELSE round(GREATEST(lim.amount - spent.amount, 0) /
            GREATEST(1, ceil(((date_trunc('month', now()) + interval '1 month')::date - now()::date) / 7.0)), 2) END
    ) FROM lim, spent;
$$;
REVOKE ALL ON FUNCTION budget.f_category_month_status(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;

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
        )
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
    IF p_profile ? 'allergies' THEN v_row.allergies := budget.f_clean_tags(p_profile->'allergies'); END IF;
    IF p_profile ? 'diet' THEN v_row.diet := budget.f_clean_tags(p_profile->'diet'); END IF;
    IF p_profile ? 'likes' THEN v_row.likes := budget.f_clean_tags(p_profile->'likes'); END IF;
    IF p_profile ? 'dislikes' THEN v_row.dislikes := budget.f_clean_tags(p_profile->'dislikes'); END IF;
    IF p_profile ? 'activities' THEN v_row.activities := budget.f_clean_tags(p_profile->'activities'); END IF;
    IF p_profile ? 'activity_level' THEN v_row.activity_level := NULLIF(lower(trim(p_profile->>'activity_level')), ''); END IF;
    IF p_profile ? 'health_goal' THEN v_row.health_goal := NULLIF(lower(trim(p_profile->>'health_goal')), ''); END IF;
    IF p_profile ? 'notes' THEN v_row.notes := NULLIF(trim(p_profile->>'notes'), ''); END IF;

    UPDATE budget.tmember_health_profile SET
        birth_year = v_row.birth_year, allergies = v_row.allergies, diet = v_row.diet,
        likes = v_row.likes, dislikes = v_row.dislikes, activities = v_row.activities,
        activity_level = v_row.activity_level, health_goal = v_row.health_goal, notes = v_row.notes,
        updated_at = now(), updated_by = auth.uid()
     WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
        'member_id', p_member_id, 'birth_year', v_row.birth_year, 'allergies', to_jsonb(v_row.allergies),
        'diet', to_jsonb(v_row.diet), 'likes', to_jsonb(v_row.likes), 'dislikes', to_jsonb(v_row.dislikes),
        'activity_level', v_row.activity_level, 'activities', to_jsonb(v_row.activities),
        'health_goal', v_row.health_goal, 'notes', v_row.notes);
END $$;

-- =====================================================================
-- 3. Save a weekly plan. Shape:
--    days: [{ day, meals: [{ type, name, ingredients: [..], cost, for? }] }]
--    shopping_list: [{ item, quantity, cost }]
--    activities: [{ name, for, cost, why }]
--    estimated_cost = sum of shopping_list costs. Replaces the active plan
--    for the same week. Rejects plans that mention a member's allergy.
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

    -- Hard safety guard: no allergen may appear in meals, ingredients or shopping items.
    v_text := lower(v_days::text || ' ' || v_shopping::text);
    SELECT a INTO v_conflict
      FROM budget.thousehold_member m
      JOIN budget.tmember_health_profile p ON p.household_member_id = m.id
      CROSS JOIN LATERAL unnest(p.allergies) a
     WHERE m.household_id = p_household_id AND m.status = 'active' AND m.deleted_at IS NULL
       AND length(a) >= 3 AND position(a IN v_text) > 0
     LIMIT 1;
    IF v_conflict IS NOT NULL THEN
        RAISE EXCEPTION 'allergen_conflict: %', v_conflict;
    END IF;

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

-- =====================================================================
-- 4. Read the active plan for a week (latest week when p_week_start is null)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.f_get_meal_plan(p_household_id UUID, p_week_start DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = budget, public AS $$
DECLARE v_result JSONB;
BEGIN
    IF NOT budget.f_health_access(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
    SELECT jsonb_build_object(
        'id', mp.id, 'week_start', mp.week_start, 'currency', mp.currency,
        'budget_amount', mp.budget_amount, 'estimated_cost', mp.estimated_cost,
        'within_budget', mp.budget_amount IS NULL OR mp.estimated_cost <= mp.budget_amount,
        'days', mp.days, 'shopping_list', mp.shopping_list, 'activities', mp.activities,
        'summary', mp.summary, 'user_request', mp.user_request, 'source', mp.source,
        'model', mp.model, 'created_at', mp.created_at)
      INTO v_result
      FROM budget.tmeal_plan mp
     WHERE mp.household_id = p_household_id AND mp.status = 'active'
       AND (p_week_start IS NULL OR mp.week_start = p_week_start)
     ORDER BY mp.week_start DESC, mp.created_at DESC
     LIMIT 1;
    RETURN v_result;
END $$;

-- =====================================================================
-- 5. Grants: members through the app, service role through n8n.
-- =====================================================================
REVOKE ALL ON FUNCTION public.f_get_family_health_context(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_upsert_member_health_profile(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_save_meal_plan(UUID, DATE, JSONB, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_get_meal_plan(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_get_family_health_context(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_upsert_member_health_profile(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_save_meal_plan(UUID, DATE, JSONB, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_get_meal_plan(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION budget.f_health_access(UUID, BOOLEAN) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
