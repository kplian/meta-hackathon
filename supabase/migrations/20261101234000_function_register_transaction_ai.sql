-- Migration: Create function budget.f_register_transaction_ai for AI Agent integration
-- Resolves household, user, auxiliar, and category identifiers from natural text, codes, or channel identifiers.

CREATE OR REPLACE FUNCTION budget.f_register_transaction_ai(
    p_channel_code TEXT,
    p_type TEXT DEFAULT 'expense',
    p_concept TEXT DEFAULT NULL,
    p_category_key TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL,
    p_household_name TEXT DEFAULT NULL,
    p_transaction_date DATE DEFAULT NULL,
    p_auxiliar_code VARCHAR DEFAULT NULL,
    p_items JSON DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = budget, public
AS $$
DECLARE
    v_user JSON;
    v_user_id UUID;
    v_user_name TEXT;
    v_household_id UUID;
    v_household_name TEXT;
    v_auxiliar_id UUID;
    v_auxiliar_name TEXT;
    v_normalized_items JSONB := NULL;
    v_items_jsonb JSONB := NULL;
    v_item JSONB;
    v_cat_str TEXT;
    v_resolved_cat_key TEXT;
    v_item_aux_id UUID;
    v_total_amount NUMERIC := 0;
    v_tx_date TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- 1. Validate and resolve user through channel identifier
    IF p_channel_code IS NULL OR trim(p_channel_code) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_CHANNEL_CODE',
            'message', 'Channel code is required.'
        );
    END IF;

    v_user := budget.f_validate_user(p_channel_code);

    IF NOT COALESCE((v_user->>'registered')::boolean, false) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'USER_NOT_REGISTERED',
            'message', COALESCE(v_user->>'message', 'The user channel identifier is not registered in the system.')
        );
    END IF;

    v_user_id := (v_user->>'userId')::UUID;
    v_user_name := COALESCE(v_user->>'fullName', 'User');

    -- 2. Resolve household by name or fallback to member's household
    IF p_household_name IS NOT NULL AND trim(p_household_name) <> '' THEN
        SELECT h.id, h.name INTO v_household_id, v_household_name
        FROM budget.thousehold h
        JOIN budget.thousehold_member hm ON hm.household_id = h.id
        WHERE hm.user_id = v_user_id
          AND (
              lower(trim(h.name)) = lower(trim(p_household_name))
              OR h.name ILIKE '%' || trim(p_household_name) || '%'
          )
          AND h.status = 'active'
        ORDER BY CASE WHEN lower(trim(h.name)) = lower(trim(p_household_name)) THEN 0 ELSE 1 END
        LIMIT 1;
    END IF;

    IF v_household_id IS NULL THEN
        IF (v_user->'household'->>'id') IS NOT NULL THEN
            v_household_id := (v_user->'household'->>'id')::UUID;
            v_household_name := v_user->'household'->>'name';
        ELSE
            SELECT h.id, h.name INTO v_household_id, v_household_name
            FROM budget.thousehold h
            JOIN budget.thousehold_member hm ON hm.household_id = h.id
            WHERE hm.user_id = v_user_id
              AND h.status = 'active'
            ORDER BY hm.created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_household_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'HOUSEHOLD_NOT_FOUND',
            'message', 'No active household was found for this user.'
        );
    END IF;

    -- 3. Resolve default auxiliar for transaction (pocket / expense bucket)
    IF p_auxiliar_code IS NOT NULL AND trim(p_auxiliar_code) <> '' THEN
        SELECT a.id, a.name INTO v_auxiliar_id, v_auxiliar_name
        FROM budget.tauxiliar a
        WHERE a.household_id = v_household_id
          AND (
              lower(trim(a.code)) = lower(trim(p_auxiliar_code))
              OR lower(trim(a.name)) = lower(trim(p_auxiliar_code))
              OR a.name ILIKE '%' || trim(p_auxiliar_code) || '%'
          )
          AND a.status = 'active'
        ORDER BY CASE 
            WHEN lower(trim(a.code)) = lower(trim(p_auxiliar_code)) THEN 0 
            WHEN lower(trim(a.name)) = lower(trim(p_auxiliar_code)) THEN 1 
            ELSE 2 
        END
        LIMIT 1;
    END IF;

    IF v_auxiliar_id IS NULL THEN
        -- Fallback to member's assigned personal auxiliar
        SELECT hm.auxiliar_id, a.name INTO v_auxiliar_id, v_auxiliar_name
        FROM budget.thousehold_member hm
        LEFT JOIN budget.tauxiliar a ON a.id = hm.auxiliar_id
        WHERE hm.household_id = v_household_id
          AND hm.user_id = v_user_id
          AND hm.auxiliar_id IS NOT NULL
        LIMIT 1;
    END IF;

    IF v_auxiliar_id IS NULL THEN
        -- Fallback to any active household auxiliar
        SELECT a.id, a.name INTO v_auxiliar_id, v_auxiliar_name
        FROM budget.tauxiliar a
        WHERE a.household_id = v_household_id
          AND a.status = 'active'
        ORDER BY a.created_at ASC
        LIMIT 1;
    END IF;

    IF v_auxiliar_id IS NULL THEN
        -- Fallback: auto-create personal auxiliar if none exists
        INSERT INTO budget.tauxiliar (
            household_id, auxiliar_type_id, code, name, description, created_by, status
        ) VALUES (
            v_household_id,
            COALESCE(
                (SELECT id FROM budget.tauxiliar_type WHERE code = 'personal' LIMIT 1),
                (SELECT id FROM budget.tauxiliar_type LIMIT 1)
            ),
            COALESCE(NULLIF(trim(p_auxiliar_code), ''), 'AUX-' || upper(substr(v_user_id::text, 1, 8))),
            v_user_name,
            'Auto-created personal auxiliar for AI agent transactions',
            v_user_id,
            'active'
        ) RETURNING id, name INTO v_auxiliar_id, v_auxiliar_name;
    END IF;

    -- 4. Parse and normalize items if provided
    IF p_items IS NOT NULL THEN
        BEGIN
            v_items_jsonb := p_items::jsonb;
        EXCEPTION WHEN OTHERS THEN
            v_items_jsonb := NULL;
        END;
    END IF;

    IF v_items_jsonb IS NOT NULL AND jsonb_typeof(v_items_jsonb) = 'array' AND jsonb_array_length(v_items_jsonb) > 0 THEN
        v_normalized_items := '[]'::jsonb;
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_jsonb)
        LOOP
            -- Resolve category identifier for item
            v_cat_str := COALESCE(
                NULLIF(trim(v_item->>'category'), ''),
                NULLIF(trim(v_item->>'category_key'), ''),
                NULLIF(trim(v_item->>'budget_type_id'), ''),
                p_category_key
            );

            IF v_cat_str IS NOT NULL AND trim(v_cat_str) <> '' THEN
                SELECT bt.category_key INTO v_resolved_cat_key
                FROM budget.tbudget_type bt
                WHERE (
                    bt.category_key = v_cat_str
                    OR bt.id::text = v_cat_str
                    OR lower(bt.name) = lower(v_cat_str)
                    OR bt.name ILIKE '%' || v_cat_str || '%'
                )
                AND (bt.household_id IS NULL OR bt.household_id = v_household_id)
                AND bt.status = 'active'
                ORDER BY 
                    CASE 
                        WHEN bt.category_key = v_cat_str THEN 0
                        WHEN bt.id::text = v_cat_str THEN 1
                        WHEN lower(bt.name) = lower(v_cat_str) THEN 2
                        ELSE 3
                    END
                LIMIT 1;

                IF v_resolved_cat_key IS NOT NULL THEN
                    v_cat_str := v_resolved_cat_key;
                END IF;
            END IF;

            -- Resolve auxiliar for item if specified
            v_item_aux_id := NULL;
            IF (v_item->>'auxiliar_code') IS NOT NULL AND trim(v_item->>'auxiliar_code') <> '' THEN
                SELECT a.id INTO v_item_aux_id
                FROM budget.tauxiliar a
                WHERE a.household_id = v_household_id
                  AND (
                      lower(trim(a.code)) = lower(trim(v_item->>'auxiliar_code'))
                      OR lower(trim(a.name)) = lower(trim(v_item->>'auxiliar_code'))
                      OR a.name ILIKE '%' || trim(v_item->>'auxiliar_code') || '%'
                  )
                  AND a.status = 'active'
                LIMIT 1;
            END IF;

            IF v_item_aux_id IS NULL AND (v_item->>'auxiliar_id') IS NOT NULL THEN
                v_item_aux_id := (v_item->>'auxiliar_id')::uuid;
            END IF;

            IF v_item_aux_id IS NULL THEN
                v_item_aux_id := v_auxiliar_id;
            END IF;

            v_normalized_items := v_normalized_items || jsonb_build_array(
                jsonb_build_object(
                    'category', v_cat_str,
                    'description', COALESCE(
                        NULLIF(trim(v_item->>'concept'), ''),
                        NULLIF(trim(v_item->>'description'), ''),
                        p_concept,
                        'Item'
                    ),
                    'amount', COALESCE((v_item->>'amount')::numeric, 0),
                    'quantity', COALESCE((v_item->>'quantity')::numeric, 1),
                    'unit_price', COALESCE((v_item->>'unit_price')::numeric, (v_item->>'amount')::numeric, 0),
                    'unit_measure_code', COALESCE(NULLIF(trim(v_item->>'unit_measure_code'), ''), 'unit'),
                    'item_code', COALESCE(NULLIF(trim(v_item->>'item_code'), ''), 'ITM'),
                    'auxiliar_id', v_item_aux_id
                )
            );
        END LOOP;
    END IF;

    -- 5. Single item fallback when no array of items is provided
    IF v_normalized_items IS NULL OR jsonb_array_length(v_normalized_items) = 0 THEN
        IF p_category_key IS NULL OR trim(p_category_key) = '' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'MISSING_CATEGORY',
                'message', 'A category or category_key is required when no items list is provided.'
            );
        END IF;

        IF p_amount IS NULL OR p_amount <= 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_AMOUNT',
                'message', 'Amount must be greater than zero when no items list is provided.'
            );
        END IF;

        -- Resolve category key or name
        v_cat_str := trim(p_category_key);
        SELECT bt.category_key INTO v_resolved_cat_key
        FROM budget.tbudget_type bt
        WHERE (
            bt.category_key = v_cat_str
            OR bt.id::text = v_cat_str
            OR lower(bt.name) = lower(v_cat_str)
            OR bt.name ILIKE '%' || v_cat_str || '%'
        )
        AND (bt.household_id IS NULL OR bt.household_id = v_household_id)
        AND bt.status = 'active'
        ORDER BY 
            CASE 
                WHEN bt.category_key = v_cat_str THEN 0
                WHEN bt.id::text = v_cat_str THEN 1
                WHEN lower(bt.name) = lower(v_cat_str) THEN 2
                ELSE 3
            END
        LIMIT 1;

        IF v_resolved_cat_key IS NOT NULL THEN
            v_cat_str := v_resolved_cat_key;
        END IF;

        v_normalized_items := jsonb_build_array(
            jsonb_build_object(
                'category', v_cat_str,
                'description', COALESCE(NULLIF(trim(p_concept), ''), 'Transacción vía IA'),
                'amount', p_amount,
                'quantity', 1,
                'unit_price', p_amount,
                'unit_measure_code', 'unit',
                'item_code', 'ITM-001',
                'auxiliar_id', v_auxiliar_id
            )
        );
    END IF;

    -- 6. Calculate total amount
    v_total_amount := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_normalized_items)
    LOOP
        v_total_amount := v_total_amount + COALESCE((v_item->>'amount')::numeric, 0);
    END LOOP;

    IF p_amount IS NOT NULL AND p_amount > 0 THEN
        v_total_amount := p_amount;
    END IF;

    -- 7. Normalize transaction date
    IF p_transaction_date IS NOT NULL THEN
        IF p_transaction_date = current_date THEN
            v_tx_date := now();
        ELSE
            v_tx_date := (p_transaction_date::text || ' 12:00:00')::timestamptz;
        END IF;
    ELSE
        v_tx_date := now();
    END IF;

    -- 8. Delegate to core accounting engine
    v_result := budget.f_register_transaction(
        p_household_id       := v_household_id,
        p_concept            := COALESCE(NULLIF(trim(p_concept), ''), 'Transacción vía IA'),
        p_amount             := v_total_amount,
        p_category           := p_category_key,
        p_type               := lower(COALESCE(NULLIF(trim(p_type), ''), 'expense')),
        p_transaction_date   := v_tx_date,
        p_operation_code     := NULL,
        p_external_reference := 'AI Channel: ' || p_channel_code,
        p_source_text        := 'Registered via AI Agent for channel ' || p_channel_code,
        p_recorded_via       := 'ai_agent',
        p_user_id            := v_user_id,
        p_auxiliar_id        := v_auxiliar_id,
        p_items              := v_normalized_items
    );

    -- 9. Enrich response with human-readable names for AI agent
    IF COALESCE((v_result->>'success')::boolean, false) THEN
        v_result := v_result || jsonb_build_object(
            'user', jsonb_build_object(
                'id', v_user_id,
                'name', v_user_name
            ),
            'household', jsonb_build_object(
                'id', v_household_id,
                'name', v_household_name
            ),
            'auxiliar', jsonb_build_object(
                'id', v_auxiliar_id,
                'name', v_auxiliar_name
            )
        );
    END IF;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLSTATE,
            'message', SQLERRM
        );
END;
$$;

-- 10. Public wrapper for PostgREST client calls
CREATE OR REPLACE FUNCTION public.f_register_transaction_ai(
    p_channel_code TEXT,
    p_type TEXT DEFAULT 'expense',
    p_concept TEXT DEFAULT NULL,
    p_category_key TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL,
    p_household_name TEXT DEFAULT NULL,
    p_transaction_date DATE DEFAULT NULL,
    p_auxiliar_code VARCHAR DEFAULT NULL,
    p_items JSON DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN budget.f_register_transaction_ai(
        p_channel_code     := p_channel_code,
        p_type             := p_type,
        p_concept          := p_concept,
        p_category_key     := p_category_key,
        p_amount           := p_amount,
        p_household_name   := p_household_name,
        p_transaction_date := p_transaction_date,
        p_auxiliar_code    := p_auxiliar_code,
        p_items            := p_items
    );
END;
$$;

-- 11. Overload f_register_transaction with channel-based signature
CREATE OR REPLACE FUNCTION budget.f_register_transaction(
    p_channel_code TEXT,
    p_type TEXT DEFAULT 'expense',
    p_concept TEXT DEFAULT NULL,
    p_category_key TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL,
    p_household_name TEXT DEFAULT NULL,
    p_transaction_date DATE DEFAULT NULL,
    p_auxiliar_code VARCHAR DEFAULT NULL,
    p_items JSON DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN budget.f_register_transaction_ai(
        p_channel_code     := p_channel_code,
        p_type             := p_type,
        p_concept          := p_concept,
        p_category_key     := p_category_key,
        p_amount           := p_amount,
        p_household_name   := p_household_name,
        p_transaction_date := p_transaction_date,
        p_auxiliar_code    := p_auxiliar_code,
        p_items            := p_items
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.f_register_transaction(
    p_channel_code TEXT,
    p_type TEXT DEFAULT 'expense',
    p_concept TEXT DEFAULT NULL,
    p_category_key TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL,
    p_household_name TEXT DEFAULT NULL,
    p_transaction_date DATE DEFAULT NULL,
    p_auxiliar_code VARCHAR DEFAULT NULL,
    p_items JSON DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN budget.f_register_transaction_ai(
        p_channel_code     := p_channel_code,
        p_type             := p_type,
        p_concept          := p_concept,
        p_category_key     := p_category_key,
        p_amount           := p_amount,
        p_household_name   := p_household_name,
        p_transaction_date := p_transaction_date,
        p_auxiliar_code    := p_auxiliar_code,
        p_items            := p_items
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION budget.f_register_transaction_ai(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, VARCHAR, JSON) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_register_transaction_ai(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, VARCHAR, JSON) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION budget.f_register_transaction(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, VARCHAR, JSON) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_register_transaction(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, VARCHAR, JSON) TO anon, authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

