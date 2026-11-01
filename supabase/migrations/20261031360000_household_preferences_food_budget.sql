-- Merge one household preference, suggest a supermarket budget from the
-- needs slice of the pyramid, and save that monthly limit.

-- Merge one key into thousehold.preferences without overwriting the rest (admin only).
CREATE OR REPLACE FUNCTION public.f_set_household_preference(p_household_id UUID, p_key TEXT, p_value JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = budget, public AS $$
DECLARE v_prefs JSONB;
BEGIN
    IF NOT budget.f_is_household_member(p_household_id, true) THEN RAISE EXCEPTION 'Only a household administrator can change preferences'; END IF;
    IF p_key IS NULL OR p_key !~ '^[a-z][a-z0-9_]{0,39}$' THEN RAISE EXCEPTION 'Invalid preference key'; END IF;
    UPDATE budget.thousehold
       SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object(p_key, COALESCE(p_value, 'null'::jsonb)),
           updated_at = now(), updated_by = auth.uid()
     WHERE id = p_household_id AND deleted_at IS NULL
    RETURNING preferences INTO v_prefs;
    IF v_prefs IS NULL THEN RAISE EXCEPTION 'Household not found'; END IF;
    RETURN v_prefs;
END $$;

-- Suggested monthly supermarket budget: estimated income x needs % x share (default 40 %).
CREATE OR REPLACE FUNCTION public.f_food_budget_suggestion(p_household_id UUID, p_share NUMERIC DEFAULT 0.40)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = budget, public AS $$
DECLARE h budget.thousehold; v_income NUMERIC; v_pct NUMERIC; v_limit NUMERIC; v_needs NUMERIC;
BEGIN
    IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
    IF p_share IS NULL OR p_share <= 0 OR p_share > 1 THEN RAISE EXCEPTION 'Share must be between 0 and 1'; END IF;
    SELECT * INTO STRICT h FROM budget.thousehold WHERE id = p_household_id AND deleted_at IS NULL;
    SELECT round(COALESCE(sum(estimated_amount * CASE frequency
        WHEN 'monthly' THEN 1 WHEN 'weekly' THEN 52::numeric/12 WHEN 'biweekly' THEN 2 WHEN 'yearly' THEN 1::numeric/12 END)
        FILTER (WHERE trim(currency) = trim(h.currency) AND frequency <> 'variable'), 0), 2)
      INTO v_income FROM budget.tincome_source WHERE household_id = h.id AND status = 'active' AND deleted_at IS NULL;
    SELECT l.min_percentage INTO v_pct FROM budget.tfinancial_pyramid_level l
     WHERE l.financial_pyramid_id = h.financial_pyramid_id AND l.code = 'needs' AND l.status = 'active' AND l.deleted_at IS NULL LIMIT 1;
    SELECT b.monthly_limit INTO v_limit FROM budget.tbudget b JOIN budget.tbudget_type bt ON bt.id = b.budget_type_id
     WHERE b.household_id = h.id AND b.deleted_at IS NULL AND bt.category_key = 'supermarket_groceries' LIMIT 1;
    v_needs := round(v_income * COALESCE(v_pct, 0) / 100, 2);
    RETURN jsonb_build_object(
        'currency', trim(COALESCE(h.currency, 'BOB')), 'monthly_income', v_income,
        'needs_percentage', v_pct, 'needs_amount', v_needs, 'share', p_share,
        'suggested_monthly', round(v_needs * p_share, 2), 'current_limit', v_limit);
END $$;

-- Save the monthly supermarket limit (admin only). Returns the category status used by the meal planner.
CREATE OR REPLACE FUNCTION public.f_set_food_budget(p_household_id UUID, p_monthly_limit NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = budget, public AS $$
DECLARE v_type UUID;
BEGIN
    IF NOT budget.f_is_household_member(p_household_id, true) THEN RAISE EXCEPTION 'Only a household administrator can set budgets'; END IF;
    IF p_monthly_limit IS NULL OR p_monthly_limit < 0 OR p_monthly_limit > 100000000 THEN RAISE EXCEPTION 'Invalid monthly limit'; END IF;
    SELECT id INTO v_type FROM budget.tbudget_type
     WHERE household_id = p_household_id AND category_key = 'supermarket_groceries' AND status = 'active' AND deleted_at IS NULL LIMIT 1;
    IF v_type IS NULL THEN RAISE EXCEPTION 'Household has no supermarket category'; END IF;
    INSERT INTO budget.tbudget (household_id, budget_type_id, monthly_limit, created_by, status)
    VALUES (p_household_id, v_type, round(p_monthly_limit, 2), auth.uid(), 'active')
    ON CONFLICT (household_id, budget_type_id) DO UPDATE
       SET monthly_limit = EXCLUDED.monthly_limit, updated_at = now(), updated_by = auth.uid(), deleted_at = NULL, status = 'active';
    RETURN budget.f_category_month_status(p_household_id, ARRAY['supermarket_groceries']);
END $$;

REVOKE ALL ON FUNCTION public.f_set_household_preference(UUID, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_food_budget_suggestion(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_set_food_budget(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_set_household_preference(UUID, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_food_budget_suggestion(UUID, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_set_food_budget(UUID, NUMERIC) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
