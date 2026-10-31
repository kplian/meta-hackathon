-- Migration: Add template_transaction_id to tbudget_type and implement f_register_transaction

-- 1. Add template_transaction_id to budget.tbudget_type
ALTER TABLE budget.tbudget_type 
ADD COLUMN IF NOT EXISTS template_transaction_id UUID REFERENCES budget.ttemplate_transaction(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tbudget_type_template_transaction ON budget.tbudget_type(template_transaction_id);

-- Assign default purchase template to existing budget categories if not assigned
DO $$
DECLARE
    v_default_template_id UUID;
BEGIN
    SELECT id INTO v_default_template_id 
    FROM budget.ttemplate_transaction 
    WHERE code = 'purchase' 
    LIMIT 1;

    IF v_default_template_id IS NOT NULL THEN
        UPDATE budget.tbudget_type
        SET template_transaction_id = v_default_template_id
        WHERE template_transaction_id IS NULL;
    END IF;
END $$;

-- 2. Create function budget.f_register_transaction
CREATE OR REPLACE FUNCTION budget.f_register_transaction(
    p_household_id UUID,
    p_concept VARCHAR,
    p_amount NUMERIC DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_type VARCHAR DEFAULT 'expense',
    p_transaction_date TIMESTAMPTZ DEFAULT now(),
    p_operation_code VARCHAR DEFAULT NULL,
    p_external_reference VARCHAR DEFAULT NULL,
    p_source_text TEXT DEFAULT NULL,
    p_recorded_via VARCHAR DEFAULT 'app',
    p_user_id UUID DEFAULT NULL,
    p_auxiliar_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_household_id UUID;
    v_auxiliar_id UUID;
    v_type VARCHAR(10);
    v_operation_code VARCHAR(50);
    v_items JSONB;
    v_item JSONB;
    v_total_amount NUMERIC := 0;
    v_sum_items NUMERIC := 0;
    v_transaction_id UUID;
    v_header_template_id UUID := NULL;
    v_input_data JSONB;

    -- Iteration variables
    v_item_idx INT := 0;
    v_cat_str TEXT;
    v_item_amount NUMERIC;
    v_item_desc VARCHAR(500);
    v_item_qty NUMERIC;
    v_item_price NUMERIC;
    v_item_code VARCHAR(30);
    v_item_unit VARCHAR(30);
    v_item_auxiliar UUID;
    v_budget_type_id UUID;
    v_budget_type_name VARCHAR(300);
    v_item_template_id UUID;
    v_resolved_template_id UUID;
    v_template_det RECORD;
    v_det_account_id UUID;
    v_debit_base NUMERIC;
    v_credit_base NUMERIC;
    v_line_desc VARCHAR(500);
    v_detail_id UUID;
    v_details_result JSONB := '[]'::jsonb;
    v_detail_count INT := 0;
    v_item_count INT := 0;
BEGIN
    -- 1. Validate household
    IF p_household_id IS NULL THEN
        RAISE EXCEPTION 'p_household_id is required';
    END IF;

    SELECT id INTO v_household_id
    FROM budget.thousehold
    WHERE id = p_household_id;

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Household with id % not found', p_household_id;
    END IF;

    -- 2. Resolve actor user
    v_user_id := COALESCE(
        p_user_id,
        auth.uid(),
        (SELECT user_id FROM budget.thousehold_member WHERE household_id = p_household_id LIMIT 1),
        (SELECT id FROM budget.tuser WHERE status = 'active' LIMIT 1)
    );

    -- 3. Resolve default auxiliar
    v_auxiliar_id := p_auxiliar_id;
    IF v_auxiliar_id IS NULL AND v_user_id IS NOT NULL THEN
        SELECT hm.auxiliar_id INTO v_auxiliar_id
        FROM budget.thousehold_member hm
        WHERE hm.household_id = p_household_id
          AND hm.user_id = v_user_id
          AND hm.auxiliar_id IS NOT NULL
        LIMIT 1;
    END IF;

    IF v_auxiliar_id IS NULL THEN
        SELECT a.id INTO v_auxiliar_id
        FROM budget.tauxiliar a
        WHERE a.household_id = p_household_id
          AND a.status = 'active'
        LIMIT 1;
    END IF;

    IF v_auxiliar_id IS NULL THEN
        SELECT a.id INTO v_auxiliar_id
        FROM budget.tauxiliar a
        WHERE a.status = 'active'
        LIMIT 1;
    END IF;

    -- 4. Validate and normalize transaction type
    v_type := lower(COALESCE(NULLIF(p_type, ''), 'expense'));
    IF v_type NOT IN ('expense', 'income') THEN
        RAISE EXCEPTION 'Invalid transaction type: %. Must be either ''expense'' or ''income''', p_type;
    END IF;

    -- 5. Normalize items list (supports both single general item and N items)
    IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
        v_items := p_items;
    ELSE
        -- Single general item flow
        IF p_category IS NULL OR trim(p_category) = '' THEN
            RAISE EXCEPTION 'p_category is required when p_items is not provided';
        END IF;

        IF p_amount IS NULL OR p_amount <= 0 THEN
            RAISE EXCEPTION 'p_amount must be greater than 0 when p_items is not provided';
        END IF;

        v_items := jsonb_build_array(
            jsonb_build_object(
                'category', p_category,
                'amount', p_amount,
                'description', p_concept,
                'quantity', 1,
                'unit_price', p_amount,
                'unit_measure_code', 'unit',
                'item_code', 'ITM-001'
            )
        );
    END IF;

    -- 6. Calculate total amount
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_amount := COALESCE((v_item->>'amount')::numeric, 0);
        IF v_item_amount <= 0 THEN
            RAISE EXCEPTION 'Each item must have an amount greater than 0';
        END IF;
        v_sum_items := v_sum_items + v_item_amount;
        v_item_count := v_item_count + 1;
    END LOOP;

    v_total_amount := COALESCE(p_amount, v_sum_items);
    IF v_total_amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be greater than 0';
    END IF;

    -- 7. Generate operation code if not provided
    v_operation_code := COALESCE(
        NULLIF(trim(p_operation_code), ''),
        'OP-' || to_char(COALESCE(p_transaction_date, now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))
    );

    -- 8. Prepare input_data payload
    v_input_data := jsonb_build_object(
        'concept', p_concept,
        'amount', v_total_amount,
        'type', v_type,
        'recorded_via', COALESCE(p_recorded_via, 'app'),
        'items', v_items
    );

    -- 9. Insert transaction header (budget.ttransaction)
    INSERT INTO budget.ttransaction (
        household_id,
        template_transaction_id,
        transaction_date,
        operation_code,
        concept,
        type,
        amount,
        external_reference,
        source_text,
        input_data,
        recorded_via,
        created_by,
        status
    ) VALUES (
        p_household_id,
        NULL, -- Will update if primary template found
        COALESCE(p_transaction_date, now()),
        v_operation_code,
        p_concept,
        v_type,
        v_total_amount,
        p_external_reference,
        p_source_text,
        v_input_data,
        COALESCE(p_recorded_via, 'app'),
        v_user_id,
        'active'
    )
    RETURNING id INTO v_transaction_id;

    -- 10. Process each item and generate detail lines (budget.ttransaction_detail)
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_idx := v_item_idx + 1;
        v_cat_str := COALESCE(v_item->>'category', v_item->>'category_id', v_item->>'budget_type_id');
        v_item_amount := (v_item->>'amount')::numeric;
        v_item_desc := COALESCE(NULLIF(v_item->>'description', ''), p_concept);
        v_item_qty := COALESCE((v_item->>'quantity')::numeric, 1);
        v_item_price := COALESCE((v_item->>'unit_price')::numeric, CASE WHEN v_item_qty > 0 THEN v_item_amount / v_item_qty ELSE v_item_amount END);
        v_item_code := COALESCE(NULLIF(v_item->>'item_code', ''), 'ITM-' || lpad(v_item_idx::text, 3, '0'));
        v_item_unit := COALESCE(NULLIF(v_item->>'unit_measure_code', ''), 'unit');
        
        -- Resolve item auxiliar
        v_item_auxiliar := COALESCE((v_item->>'auxiliar_id')::uuid, v_auxiliar_id);
        IF v_item_auxiliar IS NULL THEN
            -- Create fallback auxiliar if none exists
            INSERT INTO budget.tauxiliar (
                household_id, code, name, description, created_by, status
            ) VALUES (
                p_household_id, 'AUX-GEN', 'Auxiliar General', 'Auto-created default auxiliar', v_user_id, 'active'
            ) RETURNING id INTO v_item_auxiliar;
            v_auxiliar_id := v_item_auxiliar;
        END IF;

        -- 10.1 Resolve budget category (tbudget_type)
        SELECT bt.id, bt.name, bt.template_transaction_id
        INTO v_budget_type_id, v_budget_type_name, v_item_template_id
        FROM budget.tbudget_type bt
        WHERE (
            bt.id::text = v_cat_str
            OR bt.category_key = v_cat_str
            OR lower(bt.name) = lower(v_cat_str)
        )
        AND (bt.household_id IS NULL OR bt.household_id = p_household_id)
        AND bt.status = 'active'
        ORDER BY CASE WHEN bt.household_id = p_household_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF v_budget_type_id IS NULL THEN
            RAISE EXCEPTION 'Category not found for identifier: %', v_cat_str;
        END IF;

        -- 10.2 Resolve template_transaction
        v_resolved_template_id := COALESCE(
            (v_item->>'template_transaction_id')::uuid,
            v_item_template_id,
            (SELECT id FROM budget.ttemplate_transaction WHERE code = 'purchase' LIMIT 1),
            (SELECT id FROM budget.ttemplate_transaction WHERE status = 'active' LIMIT 1)
        );

        IF v_resolved_template_id IS NULL THEN
            RAISE EXCEPTION 'No template transaction found for category: % (id: %)', v_budget_type_name, v_budget_type_id;
        END IF;

        -- Save primary template in header if not set yet
        IF v_header_template_id IS NULL THEN
            v_header_template_id := v_resolved_template_id;
            UPDATE budget.ttransaction 
            SET template_transaction_id = v_header_template_id 
            WHERE id = v_transaction_id;
        END IF;

        -- 10.3 Query template lines (ttemplate_transaction_det)
        IF NOT EXISTS (
            SELECT 1 FROM budget.ttemplate_transaction_det 
            WHERE template_transaction_id = v_resolved_template_id 
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Template transaction % has no active detail lines configured', v_resolved_template_id;
        END IF;

        FOR v_template_det IN 
            SELECT * 
            FROM budget.ttemplate_transaction_det 
            WHERE template_transaction_id = v_resolved_template_id 
              AND status = 'active'
            ORDER BY line_number ASC
        LOOP
            -- Determine account
            v_det_account_id := COALESCE(
                (v_item->>'account_id')::uuid,
                v_template_det.account_id
            );

            -- Fallback accounts if null in template
            IF v_det_account_id IS NULL THEN
                IF lower(v_template_det.side) = 'debit' THEN
                    SELECT id INTO v_det_account_id FROM budget.taccount WHERE code = '510' AND is_postable = true LIMIT 1;
                ELSE
                    SELECT id INTO v_det_account_id FROM budget.taccount WHERE code = '110' AND is_postable = true LIMIT 1;
                END IF;
            END IF;

            IF v_det_account_id IS NULL THEN
                SELECT id INTO v_det_account_id FROM budget.taccount WHERE is_postable = true LIMIT 1;
            END IF;

            -- Calculate debit/credit base according to side
            IF lower(v_template_det.side) = 'debit' THEN
                v_debit_base := v_item_amount;
                v_credit_base := 0;
            ELSE
                v_debit_base := 0;
                v_credit_base := v_item_amount;
            END IF;

            -- Construct description
            v_line_desc := CASE 
                WHEN v_template_det.description_template IS NOT NULL AND trim(v_template_det.description_template) <> '' 
                THEN trim(v_template_det.description_template) || ' - ' || v_item_desc
                ELSE v_item_desc
            END;

            -- Insert detail line
            INSERT INTO budget.ttransaction_detail (
                transaction_id,
                account_id,
                auxiliar_id,
                budget_type_id,
                item_code,
                description,
                unit_measure_code,
                quantity,
                unit_price,
                debit_base,
                credit_base,
                created_by,
                status
            ) VALUES (
                v_transaction_id,
                v_det_account_id,
                v_item_auxiliar,
                v_budget_type_id,
                v_item_code,
                v_line_desc,
                v_item_unit,
                v_item_qty,
                v_item_price,
                v_debit_base,
                v_credit_base,
                v_user_id,
                'active'
            )
            RETURNING id INTO v_detail_id;

            v_detail_count := v_detail_count + 1;
            v_details_result := v_details_result || jsonb_build_object(
                'id', v_detail_id,
                'line_number', v_template_det.line_number,
                'side', v_template_det.side,
                'account_id', v_det_account_id,
                'auxiliar_id', v_item_auxiliar,
                'budget_type_id', v_budget_type_id,
                'item_code', v_item_code,
                'description', v_line_desc,
                'debit_base', v_debit_base,
                'credit_base', v_credit_base
            );
        END LOOP;
    END LOOP;

    -- 11. Return structured result
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transaction registered successfully',
        'transaction', jsonb_build_object(
            'id', v_transaction_id,
            'household_id', p_household_id,
            'operation_code', v_operation_code,
            'concept', p_concept,
            'type', v_type,
            'amount', v_total_amount,
            'transaction_date', COALESCE(p_transaction_date, now()),
            'recorded_via', COALESCE(p_recorded_via, 'app'),
            'template_transaction_id', v_header_template_id
        ),
        'items_count', v_item_count,
        'details_count', v_detail_count,
        'details', v_details_result
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION budget.f_register_transaction TO anon, authenticated, service_role;

-- 3. Create public schema wrapper for direct RPC client calls
CREATE OR REPLACE FUNCTION public.f_register_transaction(
    p_household_id UUID,
    p_concept VARCHAR,
    p_amount NUMERIC DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_type VARCHAR DEFAULT 'expense',
    p_transaction_date TIMESTAMPTZ DEFAULT now(),
    p_operation_code VARCHAR DEFAULT NULL,
    p_external_reference VARCHAR DEFAULT NULL,
    p_source_text TEXT DEFAULT NULL,
    p_recorded_via VARCHAR DEFAULT 'app',
    p_user_id UUID DEFAULT NULL,
    p_auxiliar_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN budget.f_register_transaction(
        p_household_id := p_household_id,
        p_concept := p_concept,
        p_amount := p_amount,
        p_category := p_category,
        p_type := p_type,
        p_transaction_date := p_transaction_date,
        p_operation_code := p_operation_code,
        p_external_reference := p_external_reference,
        p_source_text := p_source_text,
        p_recorded_via := p_recorded_via,
        p_user_id := p_user_id,
        p_auxiliar_id := p_auxiliar_id,
        p_items := p_items
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.f_register_transaction TO anon, authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

