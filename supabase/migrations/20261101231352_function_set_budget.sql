CREATE OR REPLACE FUNCTION budget.f_set_budget(
    p_channel_code TEXT,
    p_category_key TEXT,
    p_monthly_limit NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_household_id UUID;
    v_budget_type_id UUID;
    v_category_name TEXT;
    v_budget_id UUID;
    v_user json;
BEGIN
    -- 1. Validar existencia del usuario
    v_user = budget.f_validate_user(p_channel_code);

    if not coalesce((v_user->>'registered')::boolean, false) then
        raise exception '%', v_user->>'message';
    end if;

    v_user_id = (v_user->>'userId')::UUID;

    -- 2. Obtener el household del usuario (ajusta según tu modelo de relación)
    SELECT household_id INTO v_household_id
    FROM budget.thousehold_member
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Alternativa si el household_id está directamente en la tabla users:
    -- SELECT current_household_id INTO v_household_id FROM budget.users WHERE id = v_user_id;

    IF v_household_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'HOUSEHOLD_NOT_FOUND',
            'message', 'No tienes un household asignado. Crea uno primero diciendo "Crear household".'
        );
    END IF;

    -- 3. Obtener el budget_type_id a partir de category_key
    SELECT id, name INTO v_budget_type_id, v_category_name
    FROM budget.tbudget_type
    WHERE category_key = p_category_key
    LIMIT 1;

    IF v_budget_type_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CATEGORY_NOT_FOUND',
            'message', format('La categoría "%s" no es válida.', p_category_key)
        );
    END IF;

    -- 4. Insertar o actualizar el límite en tbudget (UPSERT)
    -- Si tienes constraint unique en (household_id, budget_type_id), se usa ON CONFLICT:
    INSERT INTO budget.tbudget (
        household_id,
        budget_type_id,
        monthly_limit,
        created_by
    )
    VALUES (
        v_household_id,
        v_budget_type_id,
        p_monthly_limit,
        v_user_id
    )
    ON CONFLICT (household_id, budget_type_id) 
    DO UPDATE SET 
        monthly_limit = EXCLUDED.monthly_limit,
        updated_at = NOW()
    RETURNING id INTO v_budget_id;

    -- 5. Respuesta en JSON
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Presupuesto configurado correctamente.',
        'data', jsonb_build_object(
            'category_key', p_category_key,
            'category_name', v_category_name,
            'monthly_limit', p_monthly_limit
        )
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

-- Notificar recarga de caché a PostgREST
NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION budget.f_get_pyramid_expense_summary(
    p_channel_code TEXT,
    p_household_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_household_id UUID;
    v_total_expenses NUMERIC(12,2);
    v_pyramid_data JSONB;
    v_user json;
BEGIN
    -- 1. Validar usuario
    v_user = budget.f_validate_user(p_channel_code);

    if not coalesce((v_user->>'registered')::boolean, false) then
        raise exception '%', v_user->>'message';
    end if;

    v_user_id = (v_user->>'userId')::UUID;

    -- 2. Determinar household (si tiene uno o se especifica)
    SELECT h.id INTO v_household_id
    FROM budget.thousehold_member hm
    JOIN budget.thousehold h ON h.id = hm.household_id
    WHERE hm.user_id = v_user_id
      AND (p_household_name IS NULL OR LOWER(TRIM(h.name)) = LOWER(TRIM(p_household_name)))
    LIMIT 1;

    -- 3. Calcular el gasto total del hogar/usuario
    SELECT COALESCE(SUM(t.amount), 0) INTO v_total_expenses
    FROM budget.ttransaction t
    WHERE t.created_by = v_user_id
      AND t.type = 'expense'
      AND (v_household_id IS NULL OR t.household_id = v_household_id)
      AND t.deleted_at IS NULL;

    -- 4. Calcular el porcentaje por cada nivel de la pirámide
    WITH pyramid_agg AS (
        SELECT 
            COALESCE(bt.pyramid_level, 1) AS level_id,
            CASE COALESCE(bt.pyramid_level, 1)
                WHEN 1 THEN 'Necesidades básicas'
                WHEN 2 THEN 'Seguridad'
                WHEN 3 THEN 'Comodidad'
                WHEN 4 THEN 'Experiencias'
                WHEN 5 THEN 'Lujos'
                ELSE 'Otros'
            END AS level_name,
            SUM(t.amount) AS level_amount
        FROM budget.ttransaction t
        JOIN tbudget bu on bu.id = t.budget_id
        LEFT JOIN budget.tbudget_type bt ON bt.id = bu.budget_type_id
        WHERE t.created_by = v_user_id
          AND t.type = 'expense'
          AND (v_household_id IS NULL OR t.household_id = v_household_id)
          AND t.deleted_at IS NULL
        GROUP BY bt.pyramid_level
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'level_id', level_id,
                'level_name', level_name,
                'amount', level_amount,
                'percentage', CASE 
                    WHEN v_total_expenses > 0 THEN ROUND((level_amount / v_total_expenses) * 100, 2)
                    ELSE 0 
                END
            ) ORDER BY level_id ASC
        ),
        '[]'::jsonb
    ) INTO v_pyramid_data
    FROM pyramid_agg;

    -- 5. Retornar consolidado
    RETURN jsonb_build_object(
        'success', true,
        'total_expenses', v_total_expenses,
        'pyramid_breakdown', v_pyramid_data
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';