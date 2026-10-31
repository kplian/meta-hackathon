-- Migration: Household Blueprint Provisioning Logic
-- Duplicates baseline accounts, templates, budget types, pyramid and relations for newly created households

-- Ensure cascade deletion on budget.tbudget_type when household is deleted
ALTER TABLE budget.tbudget_type 
    DROP CONSTRAINT IF EXISTS tbudget_type_household_id_fkey,
    ADD CONSTRAINT tbudget_type_household_id_fkey 
    FOREIGN KEY (household_id) REFERENCES budget.thousehold(id) ON DELETE CASCADE;

-- 1. Core Provisioning Function
CREATE OR REPLACE FUNCTION budget.f_provision_household(p_household_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_household RECORD;
    v_business_type_id UUID;
    v_user_id UUID;
    v_currency VARCHAR(10);
    v_accounts_count INT := 0;
    v_templates_count INT := 0;
    v_budget_types_count INT := 0;
    v_pyramids_count INT := 0;
    v_levels_count INT := 0;
    v_relations_count INT := 0;
    v_default_aux_id UUID;
    v_aux_type_company UUID;
BEGIN
    -- 1. Fetch target household
    SELECT * INTO v_household FROM budget.thousehold WHERE id = p_household_id;
    IF v_household.id IS NULL THEN
        RAISE EXCEPTION 'Household with ID % not found', p_household_id;
    END IF;

    v_business_type_id := v_household.business_type_id;
    IF v_business_type_id IS NULL THEN
        SELECT id INTO v_business_type_id FROM budget.tbusiness_type WHERE code = 'household' LIMIT 1;
        UPDATE budget.thousehold SET business_type_id = v_business_type_id WHERE id = p_household_id;
    END IF;

    v_user_id := COALESCE(
        v_household.created_by,
        auth.uid(),
        (SELECT user_id FROM budget.thousehold_member WHERE household_id = p_household_id LIMIT 1),
        (SELECT id FROM budget.tuser WHERE status = 'active' LIMIT 1)
    );
    v_currency := COALESCE(v_household.currency, 'BOB');

    -- Create session-safe temporary mapping table
    CREATE TEMP TABLE IF NOT EXISTS pg_temp.tmp_household_clone_map (
        entity_type VARCHAR(50) NOT NULL,
        old_id UUID NOT NULL,
        new_id UUID NOT NULL,
        PRIMARY KEY (entity_type, old_id)
    );
    TRUNCATE pg_temp.tmp_household_clone_map;

    -- =========================================================================
    -- STEP 1: Duplicate Chart of Accounts (budget.taccount)
    -- Duplicate baseline where business_type_id matches and household_id IS NULL
    -- In new records: business_type_id = NULL, household_id = p_household_id
    -- =========================================================================
    INSERT INTO pg_temp.tmp_household_clone_map (entity_type, old_id, new_id)
    SELECT 'account', id, gen_random_uuid()
    FROM budget.taccount
    WHERE business_type_id = v_business_type_id AND household_id IS NULL;

    INSERT INTO budget.taccount (
        id,
        household_id,
        account_type_id,
        parent_id,
        required_auxiliar_type_id,
        business_type_id,
        code,
        name,
        currency,
        requires_auxiliar,
        is_postable,
        created_by,
        status
    )
    SELECT
        m.new_id,
        p_household_id,
        a.account_type_id,
        pm.new_id, -- Mapped new parent account if exists, else NULL
        a.required_auxiliar_type_id,
        NULL,      -- business_type_id set to NULL
        a.code,
        a.name,
        COALESCE(v_currency, a.currency, 'BOB'),
        a.requires_auxiliar,
        a.is_postable,
        v_user_id,
        'active'
    FROM budget.taccount a
    JOIN pg_temp.tmp_household_clone_map m ON m.entity_type = 'account' AND a.id = m.old_id
    LEFT JOIN pg_temp.tmp_household_clone_map pm ON pm.entity_type = 'account' AND a.parent_id = pm.old_id;

    GET DIAGNOSTICS v_accounts_count = ROW_COUNT;

    -- =========================================================================
    -- STEP 2: Duplicate Template Transactions & Details
    -- budget.ttemplate_transaction and budget.ttemplate_transaction_det
    -- In new records: business_type_id = NULL, household_id = p_household_id
    -- Line details reference cloned accounts from STEP 1
    -- =========================================================================
    INSERT INTO pg_temp.tmp_household_clone_map (entity_type, old_id, new_id)
    SELECT 'template', id, gen_random_uuid()
    FROM budget.ttemplate_transaction
    WHERE business_type_id = v_business_type_id AND household_id IS NULL;

    INSERT INTO budget.ttemplate_transaction (
        id,
        business_type_id,
        household_id,
        code,
        name,
        version,
        description,
        input_schema,
        created_by,
        status
    )
    SELECT
        m.new_id,
        NULL,           -- business_type_id set to NULL
        p_household_id, -- household_id set to new household_id
        t.code,
        t.name,
        t.version,
        t.description,
        t.input_schema,
        v_user_id,
        'active'
    FROM budget.ttemplate_transaction t
    JOIN pg_temp.tmp_household_clone_map m ON m.entity_type = 'template' AND t.id = m.old_id;

    GET DIAGNOSTICS v_templates_count = ROW_COUNT;

    INSERT INTO budget.ttemplate_transaction_det (
        id,
        template_transaction_id,
        line_number,
        account_id,
        account_input_key,
        side,
        amount_rule,
        auxiliar_input_key,
        item_input_key,
        repeat_input_key,
        quantity_input_key,
        unit_price_input_key,
        unit_input_key,
        description_template,
        created_by,
        status
    )
    SELECT
        gen_random_uuid(),
        tm.new_id, -- Mapped new template_transaction_id
        td.line_number,
        COALESCE(am.new_id, td.account_id), -- Mapped new account_id
        td.account_input_key,
        td.side,
        td.amount_rule,
        td.auxiliar_input_key,
        td.item_input_key,
        td.repeat_input_key,
        td.quantity_input_key,
        td.unit_price_input_key,
        td.unit_input_key,
        td.description_template,
        v_user_id,
        'active'
    FROM budget.ttemplate_transaction_det td
    JOIN pg_temp.tmp_household_clone_map tm ON tm.entity_type = 'template' AND td.template_transaction_id = tm.old_id
    LEFT JOIN pg_temp.tmp_household_clone_map am ON am.entity_type = 'account' AND td.account_id = am.old_id;

    -- =========================================================================
    -- STEP 3: Duplicate Budget Types (budget.tbudget_type)
    -- In new records: business_type_id = NULL, household_id = p_household_id
    -- template_transaction_id mapped to cloned templates from STEP 2
    -- =========================================================================
    INSERT INTO pg_temp.tmp_household_clone_map (entity_type, old_id, new_id)
    SELECT 'budget_type', id, gen_random_uuid()
    FROM budget.tbudget_type
    WHERE business_type_id = v_business_type_id AND household_id IS NULL;

    INSERT INTO budget.tbudget_type (
        id,
        household_id,
        business_type_id,
        category_key,
        name,
        description,
        template_transaction_id,
        created_by,
        status
    )
    SELECT
        m.new_id,
        p_household_id, -- household_id set to new household_id
        NULL,           -- business_type_id set to NULL
        bt.category_key,
        bt.name,
        bt.description,
        COALESCE(tm.new_id, bt.template_transaction_id), -- Mapped new template_transaction_id
        v_user_id,
        'active'
    FROM budget.tbudget_type bt
    JOIN pg_temp.tmp_household_clone_map m ON m.entity_type = 'budget_type' AND bt.id = m.old_id
    LEFT JOIN pg_temp.tmp_household_clone_map tm ON tm.entity_type = 'template' AND bt.template_transaction_id = tm.old_id;

    GET DIAGNOSTICS v_budget_types_count = ROW_COUNT;

    -- =========================================================================
    -- STEP 4: Duplicate Financial Pyramid & Levels
    -- budget.tfinancial_pyramid and budget.tfinancial_pyramid_level
    -- In new records: business_type_id = NULL, household_id = p_household_id
    -- =========================================================================
    INSERT INTO pg_temp.tmp_household_clone_map (entity_type, old_id, new_id)
    SELECT 'pyramid', id, gen_random_uuid()
    FROM budget.tfinancial_pyramid
    WHERE business_type_id = v_business_type_id AND household_id IS NULL;

    INSERT INTO budget.tfinancial_pyramid (
        id,
        business_type_id,
        household_id,
        code,
        name,
        description,
        created_by,
        status
    )
    SELECT
        m.new_id,
        NULL,           -- business_type_id set to NULL
        p_household_id, -- household_id set to new household_id
        fp.code,
        fp.name,
        fp.description,
        v_user_id,
        'active'
    FROM budget.tfinancial_pyramid fp
    JOIN pg_temp.tmp_household_clone_map m ON m.entity_type = 'pyramid' AND fp.id = m.old_id;

    GET DIAGNOSTICS v_pyramids_count = ROW_COUNT;

    INSERT INTO pg_temp.tmp_household_clone_map (entity_type, old_id, new_id)
    SELECT 'pyramid_level', fpl.id, gen_random_uuid()
    FROM budget.tfinancial_pyramid_level fpl
    JOIN pg_temp.tmp_household_clone_map pm ON pm.entity_type = 'pyramid' AND fpl.financial_pyramid_id = pm.old_id;

    INSERT INTO budget.tfinancial_pyramid_level (
        id,
        financial_pyramid_id,
        code,
        name,
        order_by,
        min_percentage,
        max_percentage,
        created_by,
        status
    )
    SELECT
        lm.new_id,
        pm.new_id, -- Mapped new financial_pyramid_id
        fpl.code,
        fpl.name,
        fpl.order_by,
        fpl.min_percentage,
        fpl.max_percentage,
        v_user_id,
        'active'
    FROM budget.tfinancial_pyramid_level fpl
    JOIN pg_temp.tmp_household_clone_map pm ON pm.entity_type = 'pyramid' AND fpl.financial_pyramid_id = pm.old_id
    JOIN pg_temp.tmp_household_clone_map lm ON lm.entity_type = 'pyramid_level' AND fpl.id = lm.old_id;

    GET DIAGNOSTICS v_levels_count = ROW_COUNT;

    -- =========================================================================
    -- STEP 5: Duplicate Category <-> Pyramid Level Relations
    -- budget.tbudget_type_pyramid_level
    -- Maps newly cloned budget_type_id to newly cloned financial_pyramid_level_id
    -- =========================================================================
    INSERT INTO budget.tbudget_type_pyramid_level (
        id,
        financial_pyramid_level_id,
        budget_type_id,
        created_by,
        status
    )
    SELECT
        gen_random_uuid(),
        lm.new_id, -- Mapped new financial_pyramid_level_id
        bm.new_id, -- Mapped new budget_type_id
        v_user_id,
        'active'
    FROM budget.tbudget_type_pyramid_level btpl
    JOIN pg_temp.tmp_household_clone_map bm 
        ON bm.entity_type = 'budget_type' AND btpl.budget_type_id = bm.old_id
    JOIN pg_temp.tmp_household_clone_map lm 
        ON lm.entity_type = 'pyramid_level' AND btpl.financial_pyramid_level_id = lm.old_id;

    GET DIAGNOSTICS v_relations_count = ROW_COUNT;

    -- =========================================================================
    -- STEP 6: Initialize Budget limits (0.00) for all cloned household categories
    -- =========================================================================
    INSERT INTO budget.tbudget (household_id, budget_type_id, monthly_limit, created_by, status)
    SELECT p_household_id, m.new_id, 0.00, v_user_id, 'active'
    FROM pg_temp.tmp_household_clone_map m
    WHERE m.entity_type = 'budget_type'
    ON CONFLICT (household_id, budget_type_id) DO NOTHING;

    -- =========================================================================
    -- STEP 7: Link Creator User as Household Admin & Ensure Default Auxiliar
    -- =========================================================================
    IF v_household.auxiliar_id IS NULL THEN
        SELECT id INTO v_aux_type_company FROM budget.tauxiliar_type WHERE code = 'company' LIMIT 1;
        INSERT INTO budget.tauxiliar (household_id, auxiliar_type_id, code, name, description, created_by, status)
        VALUES (p_household_id, v_aux_type_company, 'AUX-GEN', 'Comercios y General', 'Auxiliar general inicial del hogar', v_user_id, 'active')
        RETURNING id INTO v_default_aux_id;

        UPDATE budget.thousehold SET auxiliar_id = v_default_aux_id WHERE id = p_household_id;
    ELSE
        v_default_aux_id := v_household.auxiliar_id;
    END IF;

    IF v_user_id IS NOT NULL THEN
        INSERT INTO budget.thousehold_member (household_id, user_id, role, auxiliar_id, member_type, status, created_by)
        VALUES (p_household_id, v_user_id, 'admin', v_default_aux_id, 'other', 'active', v_user_id)
        ON CONFLICT (household_id, user_id) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'household_id', p_household_id,
        'accounts_created', v_accounts_count,
        'templates_created', v_templates_count,
        'budget_types_created', v_budget_types_count,
        'pyramids_created', v_pyramids_count,
        'levels_created', v_levels_count,
        'relations_created', v_relations_count
    );
END;
$$;

-- 2. Trigger Function for Automatic Provisioning on thousehold Insert
CREATE OR REPLACE FUNCTION budget.f_trg_provision_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Provision only if business_type_id is provided and household does not already have accounts
    IF NEW.business_type_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM budget.taccount WHERE household_id = NEW.id
    ) THEN
        PERFORM budget.f_provision_household(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_auto_provision ON budget.thousehold;
CREATE TRIGGER trg_household_auto_provision
AFTER INSERT ON budget.thousehold
FOR EACH ROW
EXECUTE FUNCTION budget.f_trg_provision_household();

-- 3. Stored Function budget.f_create_household for RPC calls
CREATE OR REPLACE FUNCTION budget.f_create_household(
    p_name VARCHAR,
    p_business_type_id UUID DEFAULT NULL,
    p_currency VARCHAR DEFAULT 'BOB',
    p_auxiliar_id UUID DEFAULT NULL,
    p_preferences JSONB DEFAULT '{}'::jsonb,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_household_id UUID;
    v_business_type_id UUID := p_business_type_id;
    v_user_id UUID := COALESCE(p_user_id, auth.uid(), (SELECT id FROM budget.tuser WHERE status = 'active' LIMIT 1));
BEGIN
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'p_name is required';
    END IF;

    IF v_business_type_id IS NULL THEN
        SELECT id INTO v_business_type_id FROM budget.tbusiness_type WHERE code = 'household' LIMIT 1;
    END IF;

    -- Insert new household row (fires trg_household_auto_provision)
    INSERT INTO budget.thousehold (
        business_type_id,
        name,
        currency,
        auxiliar_id,
        preferences,
        created_by,
        status
    ) VALUES (
        v_business_type_id,
        trim(p_name),
        COALESCE(NULLIF(trim(p_currency), ''), 'BOB'),
        p_auxiliar_id,
        COALESCE(p_preferences, '{}'::jsonb),
        v_user_id,
        'active'
    )
    RETURNING id INTO v_household_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Household created and provisioned successfully',
        'household_id', v_household_id,
        'name', p_name,
        'business_type_id', v_business_type_id,
        'currency', COALESCE(NULLIF(trim(p_currency), ''), 'BOB')
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLSTATE,
            'message', SQLERRM
        );
END;
$$;

-- 4. Public schema wrapper for direct PostgREST RPC
CREATE OR REPLACE FUNCTION public.f_create_household(
    p_name VARCHAR,
    p_business_type_id UUID DEFAULT NULL,
    p_currency VARCHAR DEFAULT 'BOB',
    p_auxiliar_id UUID DEFAULT NULL,
    p_preferences JSONB DEFAULT '{}'::jsonb,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN budget.f_create_household(
        p_name := p_name,
        p_business_type_id := p_business_type_id,
        p_currency := p_currency,
        p_auxiliar_id := p_auxiliar_id,
        p_preferences := p_preferences,
        p_user_id := p_user_id
    );
END;
$$;

-- 5. Grants
GRANT EXECUTE ON FUNCTION budget.f_provision_household(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION budget.f_create_household(VARCHAR, UUID, VARCHAR, UUID, JSONB, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_create_household(VARCHAR, UUID, VARCHAR, UUID, JSONB, UUID) TO anon, authenticated, service_role;

-- 6. Provision any existing households that do not have their accounts yet
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM budget.thousehold WHERE business_type_id IS NOT NULL LOOP
        IF NOT EXISTS (SELECT 1 FROM budget.taccount WHERE household_id = r.id) THEN
            PERFORM budget.f_provision_household(r.id);
        END IF;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
