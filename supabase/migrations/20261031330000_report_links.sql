-- =====================================================================
-- Migration: Short-lived report links for WhatsApp (cta_url button)
-- n8n creates a token with the service role key and sends the link
-- https://<web-app>/reporte?t=<token> inside a WhatsApp interactive
-- message. The web page reads the report with that token only, so no
-- personal data travels in the URL and no login is needed.
-- =====================================================================

CREATE TABLE IF NOT EXISTS budget.treport_link (
    token VARCHAR(64) NOT NULL,
    household_id UUID NOT NULL,
    user_id UUID,
    period_month DATE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    open_count INTEGER NOT NULL DEFAULT 0,
    last_opened_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT treport_link_pkey PRIMARY KEY (token),
    CONSTRAINT treport_link_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT treport_link_user_id_fkey FOREIGN KEY (user_id) REFERENCES budget.tuser (id) ON DELETE SET NULL
);

-- Only reachable through the SECURITY DEFINER functions below
ALTER TABLE budget.treport_link ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON budget.treport_link FROM anon, authenticated;

-- =====================================================================
-- 1. Create a link (n8n, service role only)
-- =====================================================================
CREATE OR REPLACE FUNCTION budget.f_create_report_link(
    p_household_id UUID,
    p_month DATE DEFAULT NULL,
    p_ttl_minutes INTEGER DEFAULT 30,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = budget, public, extensions
AS $$
DECLARE
    v_token VARCHAR(64);
    v_month DATE := date_trunc('month', COALESCE(p_month, now()::date))::date;
    v_expires TIMESTAMP WITH TIME ZONE := now() + make_interval(mins => LEAST(GREATEST(COALESCE(p_ttl_minutes, 30), 1), 1440));
BEGIN
    IF NOT EXISTS (SELECT 1 FROM budget.thousehold WHERE id = p_household_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Household % not found', p_household_id;
    END IF;

    v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');

    INSERT INTO budget.treport_link (token, household_id, user_id, period_month, expires_at)
    VALUES (v_token, p_household_id, p_user_id, v_month, v_expires);

    RETURN jsonb_build_object('token', v_token, 'period_month', v_month, 'expires_at', v_expires);
END;
$$;

-- =====================================================================
-- 2. Read the report by token (public web page, anon)
-- =====================================================================
CREATE OR REPLACE FUNCTION budget.f_get_report(p_token VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = budget, public
AS $$
DECLARE
    v_link budget.treport_link%ROWTYPE;
    v_from TIMESTAMP WITH TIME ZONE;
    v_to TIMESTAMP WITH TIME ZONE;
    v_result JSONB;
BEGIN
    SELECT * INTO v_link FROM budget.treport_link WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'invalid');
    END IF;
    IF v_link.expires_at < now() THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    UPDATE budget.treport_link
       SET open_count = open_count + 1, last_opened_at = now()
     WHERE token = p_token;

    v_from := v_link.period_month::timestamptz;
    v_to := (v_link.period_month + INTERVAL '1 month')::timestamptz;

    WITH tx AS (
        SELECT t.*
          FROM budget.ttransaction t
         WHERE t.household_id = v_link.household_id
           AND t.deleted_at IS NULL
           AND COALESCE(t.status, 'active') = 'active'
           AND t.transaction_date >= v_from
           AND t.transaction_date < v_to
    ),
    -- Spending can point to global budget types and limits to the household's
    -- own copies, so both sides are matched by category_key.
    spent AS (
        SELECT bt.category_key, MIN(bt.name) AS name, SUM(d.debit_base) AS amount
          FROM tx
          JOIN budget.ttransaction_detail d ON d.transaction_id = tx.id AND d.deleted_at IS NULL
          JOIN budget.tbudget_type bt ON bt.id = d.budget_type_id
         WHERE tx.type = 'expense' AND d.debit_base > 0
         GROUP BY bt.category_key
    ),
    limits AS (
        SELECT bt.category_key, MIN(bt.name) AS name, SUM(b.monthly_limit) AS amount
          FROM budget.tbudget b
          JOIN budget.tbudget_type bt ON bt.id = b.budget_type_id
         WHERE b.household_id = v_link.household_id
           AND b.deleted_at IS NULL
           AND b.monthly_limit > 0
         GROUP BY bt.category_key
    ),
    categories AS (
        SELECT COALESCE(s.category_key, l.category_key) AS category_key,
               COALESCE(l.name, s.name) AS name,
               COALESCE(s.amount, 0) AS spent,
               l.amount AS budget
          FROM spent s
          FULL JOIN limits l ON l.category_key = s.category_key
    )
    SELECT jsonb_build_object(
        'status', 'ok',
        'household', jsonb_build_object('name', h.name, 'currency', COALESCE(h.currency, 'BOB')),
        'period_month', v_link.period_month,
        'expires_at', v_link.expires_at,
        'totals', jsonb_build_object(
            'income', COALESCE((SELECT SUM(amount) FROM tx WHERE type = 'income'), 0),
            'expense', COALESCE((SELECT SUM(amount) FROM tx WHERE type = 'expense'), 0),
            'budget', COALESCE((SELECT SUM(budget) FROM categories), 0)
        ),
        'categories', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'category_key', c.category_key, 'name', c.name,
                       'spent', c.spent, 'budget', c.budget)
                   ORDER BY c.spent DESC, c.name)
              FROM categories c
        ), '[]'::jsonb),
        'transactions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'date', r.transaction_date, 'concept', r.concept,
                       'type', r.type, 'amount', r.amount)
                   ORDER BY r.transaction_date DESC)
              FROM (SELECT * FROM tx ORDER BY transaction_date DESC LIMIT 15) r
        ), '[]'::jsonb)
    )
      INTO v_result
      FROM budget.thousehold h
     WHERE h.id = v_link.household_id;

    RETURN v_result;
END;
$$;

-- =====================================================================
-- 3. Public schema wrappers for direct PostgREST RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.f_create_report_link(
    p_household_id UUID,
    p_month DATE DEFAULT NULL,
    p_ttl_minutes INTEGER DEFAULT 30,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN budget.f_create_report_link(
        p_household_id := p_household_id,
        p_month := p_month,
        p_ttl_minutes := p_ttl_minutes,
        p_user_id := p_user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.f_get_report(p_token VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN budget.f_get_report(p_token := p_token);
END;
$$;

-- =====================================================================
-- 4. Grants: anyone may read with a valid token, only the service role
--    (n8n) may create links. Default privileges grant EXECUTE to anon,
--    so revoke explicitly.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION budget.f_create_report_link(UUID, DATE, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.f_create_report_link(UUID, DATE, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION budget.f_create_report_link(UUID, DATE, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.f_create_report_link(UUID, DATE, INTEGER, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION budget.f_get_report(VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_get_report(VARCHAR) TO anon, authenticated, service_role;
