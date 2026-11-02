CREATE OR REPLACE FUNCTION budget.f_create_household_ai(
    p_channel_code VARCHAR,
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