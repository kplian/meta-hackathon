CREATE OR REPLACE FUNCTION budget.f_create_household(
    p_channel_code TEXT,
    p_name VARCHAR,
    p_currency VARCHAR DEFAULT 'BOB'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_household_id UUID;
    v_user json;
BEGIN
    -- 1. Validar existencia del usuario por su identificador de chat
    v_user = budget.f_validate_user(p_channel_code);

    if not coalesce((v_user->>'registered')::boolean, false) then
        raise exception '%', v_user->>'message';
    end if;

    -- 2. Insertar el nuevo hogar / household
    -- Nota: Cambia 'households' por 'thousehold' si ese es el nombre literal de tu tabla
    INSERT INTO budget.thousehold (
        name,
        currency
    )
    VALUES (
        p_name,
        COALESCE(NULLIF(p_currency, ''), 'BOB')
    )
    RETURNING id INTO v_household_id;

    -- 3. Vincular el usuario al household
    INSERT INTO budget.thousehold_member (household_id, user_id, role)
    VALUES (v_household_id, (v_user->>'userId')::UUID, 'admin')
    ON CONFLICT DO NOTHING;

    -- 4. NUEVO: Inicializar el presupuesto en 0 para todas las categorías existentes
    INSERT INTO budget.tbudget (household_id, budget_type_id, monthly_limit)
    SELECT v_household_id, id, 0.00
    FROM budget.tbudget_type
    ON CONFLICT DO NOTHING;

    -- 5. Notificar a PostgREST y responder
    RETURN jsonb_build_object(
        'success', true,
        'message', '¡Hogar creado exitosamente! Se han habilitado las categorías con límite cero. Recuerda configurar tus presupuestos mensuales cuando desees.',
        'household', jsonb_build_object(
            'id', v_household_id,
            'name', p_name,
            'currency', COALESCE(NULLIF(p_currency, ''), 'BOB')
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

-- Refrescar la caché de PostgREST inmediatamente
NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION budget.f_get_user_households(
    p_channel_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_households JSONB;
    v_total_count INT;
    v_user json;
BEGIN
    -- 1. Identificar el usuario por su teléfono o telegram_id
    -- Check identity
    v_user = budget.f_validate_user(p_channel_code);

    if not coalesce((v_user->>'registered')::boolean, false) then
        raise exception '%', v_user->>'message';
    end if;

    -- 2. Obtener la lista de households vinculados a través de la relación de miembros
    -- Nota: Ajusta los nombres de tabla si en tu base son thousehold y thousehold_members
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', h.id,
                    'name', h.name,
                    'currency', h.currency,
                    'locale', u.locale,
                    'role', COALESCE(hm.role, 'member')
                ) ORDER BY h.name ASC
            ),
            '[]'::jsonb
        ),
        COUNT(h.id)
    INTO v_households, v_total_count
    FROM budget.thousehold_member hm
    JOIN budget.thousehold h ON h.id = hm.household_id
    JOIN budget.tuser u ON u.id = hm.user_id
    WHERE hm.user_id = (v_user->>'userId')::UUID;

    -- 3. Retornar el resultado estructurado
    RETURN jsonb_build_object(
        'success', true,
        'count', v_total_count,
        'households', v_households
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

-- Refrescar la caché de PostgREST
NOTIFY pgrst, 'reload schema';