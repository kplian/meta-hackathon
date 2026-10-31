-- Migration: Household & Member Auto Auxiliars & Creator Admin Membership
-- 1. Create household-level auxiliar with the household name and link it to thousehold.auxiliar_id
-- 2. Ensure household creator is registered in thousehold_member with role 'admin'
-- 3. Automatic personal auxiliar creation on every thousehold_member insert

-- Ensure FK cascade/set-null behavior on thousehold_member.auxiliar_id
ALTER TABLE budget.thousehold_member 
    DROP CONSTRAINT IF EXISTS thousehold_member_auxiliar_id_fkey,
    ADD CONSTRAINT thousehold_member_auxiliar_id_fkey 
    FOREIGN KEY (auxiliar_id) REFERENCES budget.tauxiliar(id) ON DELETE SET NULL;

-- 1. Trigger Function: Auto-create personal Auxiliar for every new Household Member
CREATE OR REPLACE FUNCTION budget.f_trg_household_member_auto_auxiliar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_name VARCHAR(150);
    v_person_type_id UUID;
    v_aux_code VARCHAR(50);
    v_new_aux_id UUID;
    v_suffix INT := 1;
BEGIN
    -- Fetch user full name from budget.tuser
    SELECT full_name INTO v_user_name FROM budget.tuser WHERE id = NEW.user_id;
    IF v_user_name IS NULL OR trim(v_user_name) = '' THEN
        v_user_name := 'Usuario ' || SUBSTRING(REPLACE(NEW.user_id::text, '-', '') FROM 1 FOR 6);
    END IF;

    -- Fetch 'person' auxiliar_type_id
    SELECT id INTO v_person_type_id FROM budget.tauxiliar_type WHERE code = 'person' LIMIT 1;
    IF v_person_type_id IS NULL THEN
        SELECT id INTO v_person_type_id FROM budget.tauxiliar_type LIMIT 1;
    END IF;

    -- Generate a unique code within this household
    v_aux_code := 'AUX-USR-' || SUBSTRING(REPLACE(NEW.user_id::text, '-', '') FROM 1 FOR 6);
    WHILE EXISTS (SELECT 1 FROM budget.tauxiliar WHERE household_id = NEW.household_id AND code = v_aux_code) LOOP
        v_suffix := v_suffix + 1;
        v_aux_code := 'AUX-USR-' || SUBSTRING(REPLACE(NEW.user_id::text, '-', '') FROM 1 FOR 4) || '-' || v_suffix;
    END LOOP;

    -- Create personal auxiliar for the member with the user's name
    INSERT INTO budget.tauxiliar (
        household_id,
        auxiliar_type_id,
        code,
        name,
        description,
        created_by,
        status
    ) VALUES (
        NEW.household_id,
        v_person_type_id,
        v_aux_code,
        trim(v_user_name),
        'Auxiliar personal de ' || trim(v_user_name),
        COALESCE(NEW.created_by, NEW.user_id),
        'active'
    )
    RETURNING id INTO v_new_aux_id;

    -- Assign the new personal auxiliar to this member
    NEW.auxiliar_id := v_new_aux_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_member_auto_auxiliar ON budget.thousehold_member;
CREATE TRIGGER trg_household_member_auto_auxiliar
BEFORE INSERT ON budget.thousehold_member
FOR EACH ROW
EXECUTE FUNCTION budget.f_trg_household_member_auto_auxiliar();

-- 2. Update Provisioning Function to create Household-level Auxiliar and Creator Member
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
    v_household_aux_id UUID;
    v_aux_type_company UUID;
    v_hh_aux_code VARCHAR(50);
    v_suffix INT := 1;
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
        (SELECT id FROM budget.tuser WHERE status = 'active' ORDER BY created_at ASC LIMIT 1)
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
        pm.new_id,
        a.required_auxiliar_type_id,
        NULL,
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
        NULL,
        p_household_id,
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
        tm.new_id,
        td.line_number,
        COALESCE(am.new_id, td.account_id),
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
        p_household_id,
        NULL,
        bt.category_key,
        bt.name,
        bt.description,
        COALESCE(tm.new_id, bt.template_transaction_id),
        v_user_id,
        'active'
    FROM budget.tbudget_type bt
    JOIN pg_temp.tmp_household_clone_map m ON m.entity_type = 'budget_type' AND bt.id = m.old_id
    LEFT JOIN pg_temp.tmp_household_clone_map tm ON tm.entity_type = 'template' AND bt.template_transaction_id = tm.old_id;

    GET DIAGNOSTICS v_budget_types_count = ROW_COUNT;

    -- =========================================================================
    -- STEP 4: Duplicate Financial Pyramid & Levels
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
        NULL,
        p_household_id,
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
        pm.new_id,
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
        lm.new_id,
        bm.new_id,
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
    -- STEP 7: Create Household-Level Auxiliar with Household Name & Update thousehold
    -- =========================================================================
    SELECT id INTO v_aux_type_company FROM budget.tauxiliar_type WHERE code = 'company' LIMIT 1;
    IF v_aux_type_company IS NULL THEN
        SELECT id INTO v_aux_type_company FROM budget.tauxiliar_type LIMIT 1;
    END IF;

    v_hh_aux_code := 'AUX-HH-' || SUBSTRING(REPLACE(p_household_id::text, '-', '') FROM 1 FOR 6);
    WHILE EXISTS (SELECT 1 FROM budget.tauxiliar WHERE household_id = p_household_id AND code = v_hh_aux_code) LOOP
        v_suffix := v_suffix + 1;
        v_hh_aux_code := 'AUX-HH-' || SUBSTRING(REPLACE(p_household_id::text, '-', '') FROM 1 FOR 4) || '-' || v_suffix;
    END LOOP;

    INSERT INTO budget.tauxiliar (
        household_id,
        auxiliar_type_id,
        code,
        name,
        description,
        created_by,
        status
    ) VALUES (
        p_household_id,
        v_aux_type_company,
        v_hh_aux_code,
        trim(v_household.name),
        'Auxiliar general del hogar ' || trim(v_household.name),
        v_user_id,
        'active'
    )
    RETURNING id INTO v_household_aux_id;

    UPDATE budget.thousehold 
    SET auxiliar_id = v_household_aux_id 
    WHERE id = p_household_id;

    -- =========================================================================
    -- STEP 8: Ensure Creator User is Registered as 'admin' in thousehold_member
    -- (This insert fires trg_household_member_auto_auxiliar to auto-create their personal auxiliar!)
    -- =========================================================================
    IF v_user_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM budget.thousehold_member 
            WHERE household_id = p_household_id AND user_id = v_user_id
        ) THEN
            INSERT INTO budget.thousehold_member (
                household_id,
                user_id,
                role,
                member_type,
                status,
                created_by
            ) VALUES (
                p_household_id,
                v_user_id,
                'admin',
                'other',
                'active',
                v_user_id
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'household_id', p_household_id,
        'household_auxiliar_id', v_household_aux_id,
        'accounts_created', v_accounts_count,
        'templates_created', v_templates_count,
        'budget_types_created', v_budget_types_count,
        'pyramids_created', v_pyramids_count,
        'levels_created', v_levels_count,
        'relations_created', v_relations_count
    );
END;
$$;

-- 3. One-Time Synchronization for Existing Households and Members
DO $$
DECLARE
    r_hh RECORD;
    r_mem RECORD;
    v_aux_id UUID;
    v_user_name VARCHAR(150);
    v_company_type_id UUID;
    v_person_type_id UUID;
    v_code VARCHAR(50);
    v_counter INT := 0;
BEGIN
    SELECT id INTO v_company_type_id FROM budget.tauxiliar_type WHERE code = 'company' LIMIT 1;
    SELECT id INTO v_person_type_id FROM budget.tauxiliar_type WHERE code = 'person' LIMIT 1;

    -- A. Ensure each existing household has an auxiliar named after the household
    FOR r_hh IN SELECT id, name, created_by, auxiliar_id FROM budget.thousehold LOOP
        -- Check if current auxiliar already has the household's name
        IF NOT EXISTS (
            SELECT 1 FROM budget.tauxiliar 
            WHERE id = r_hh.auxiliar_id AND name = trim(r_hh.name)
        ) THEN
            v_code := 'AUX-HH-' || SUBSTRING(REPLACE(r_hh.id::text, '-', '') FROM 1 FOR 6);
            v_counter := 1;
            WHILE EXISTS (SELECT 1 FROM budget.tauxiliar WHERE household_id = r_hh.id AND code = v_code) LOOP
                v_counter := v_counter + 1;
                v_code := 'AUX-HH-' || SUBSTRING(REPLACE(r_hh.id::text, '-', '') FROM 1 FOR 4) || '-' || v_counter;
            END LOOP;

            INSERT INTO budget.tauxiliar (
                household_id,
                auxiliar_type_id,
                code,
                name,
                description,
                created_by,
                status
            ) VALUES (
                r_hh.id,
                v_company_type_id,
                v_code,
                trim(r_hh.name),
                'Auxiliar general del hogar ' || trim(r_hh.name),
                r_hh.created_by,
                'active'
            )
            RETURNING id INTO v_aux_id;

            UPDATE budget.thousehold SET auxiliar_id = v_aux_id WHERE id = r_hh.id;
        END IF;
    END LOOP;

    -- B. Ensure each existing member has their own personal auxiliar named after them
    FOR r_mem IN 
        SELECT hm.id, hm.household_id, hm.user_id, hm.auxiliar_id, hm.created_by, u.full_name
        FROM budget.thousehold_member hm
        JOIN budget.tuser u ON hm.user_id = u.id
    LOOP
        -- If member has no auxiliar, or its auxiliar is shared or not named after the user
        IF r_mem.auxiliar_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM budget.tauxiliar 
            WHERE id = r_mem.auxiliar_id AND name = trim(r_mem.full_name)
        ) THEN
            v_code := 'AUX-USR-' || SUBSTRING(REPLACE(r_mem.user_id::text, '-', '') FROM 1 FOR 6);
            v_counter := 1;
            WHILE EXISTS (SELECT 1 FROM budget.tauxiliar WHERE household_id = r_mem.household_id AND code = v_code) LOOP
                v_counter := v_counter + 1;
                v_code := 'AUX-USR-' || SUBSTRING(REPLACE(r_mem.user_id::text, '-', '') FROM 1 FOR 4) || '-' || v_counter;
            END LOOP;

            INSERT INTO budget.tauxiliar (
                household_id,
                auxiliar_type_id,
                code,
                name,
                description,
                created_by,
                status
            ) VALUES (
                r_mem.household_id,
                v_person_type_id,
                v_code,
                trim(r_mem.full_name),
                'Auxiliar personal de ' || trim(r_mem.full_name),
                COALESCE(r_mem.created_by, r_mem.user_id),
                'active'
            )
            RETURNING id INTO v_aux_id;

            UPDATE budget.thousehold_member SET auxiliar_id = v_aux_id WHERE id = r_mem.id;
        END IF;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

