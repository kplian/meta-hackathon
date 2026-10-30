CREATE OR REPLACE FUNCTION budget.f_add_user_to_household(
    p_admin_channel_code TEXT,       -- Quién realiza la acción (para validar permisos si es necesario)
    p_target_full_name VARCHAR(100),   -- Nombre del nuevo usuario a registrar/agregar
    p_target_channel_code VARCHAR(50),-- Channel code del nuevo usuario
    p_target_channel_type VARCHAR(50) default 'whatsapp',-- Channel code del nuevo usuario
    p_household_name VARCHAR DEFAULT NULL,    -- Nombre del hogar al que se le quiere agregar
    p_target_email_user VARCHAR(100) DEFAULT NULL,
    p_role VARCHAR DEFAULT 'member'           -- Rol dentro del hogar ('admin' o 'member')
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID;
    v_target_user_id UUID;
    v_household_id UUID;
    v_household_name TEXT;
    v_user_created BOOLEAN := FALSE;
    v_user json;
    v_user_id UUID;
    v_new_user json;
BEGIN
    -- 1. Identificar al usuario
    v_user = budget.f_validate_user(p_admin_channel_code);

    if not coalesce((v_user->>'registered')::boolean, false) then
        raise exception '%', v_user->>'message';
    end if;

    v_user_id = (v_user->>'userId')::UUID;

    -- 1. Check parameters
    --2. 


    -- 5. Retornar éxito estructurado
    RETURN jsonb_build_object(
        'success', true,
        'message', format('¡Usuario %s agregado exitosamente al hogar "%s"!', p_target_full_name, v_household_name),
        'details', jsonb_build_object(
            'user_id', v_target_user_id,
            'user_created_new', v_user_created,
            'household_name', v_household_name,
            'role', COALESCE(NULLIF(p_role, ''), 'member')
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