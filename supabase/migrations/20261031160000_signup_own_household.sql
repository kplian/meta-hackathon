-- A normal signup starts a new family. Existing memberships are preserved,
-- including accounts already attached through another registration flow.
CREATE OR REPLACE FUNCTION budget.f_handle_auth_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = budget, public
AS $$
DECLARE
    v_full_name VARCHAR(100);
    v_family_name TEXT;
    v_result JSONB;
BEGIN
    v_full_name := left(COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(split_part(NEW.email, '@', 1), ''), 'Usuario'
    ), 100);

    INSERT INTO budget.tuser (id, full_name, email_user, locale, timezone, role, status, created_at)
    VALUES (NEW.id, v_full_name, NEW.email, 'es', 'UTC', 'member', 'active', COALESCE(NEW.created_at, now()))
    ON CONFLICT (email_user) DO UPDATE
    SET full_name = EXCLUDED.full_name, updated_at = now();

    -- Refreshes and subsequent sign-ins must never create additional households.
    IF TG_OP = 'INSERT' AND NOT EXISTS (
        SELECT 1 FROM budget.thousehold_member WHERE user_id = NEW.id
    ) THEN
        v_family_name := COALESCE(
            NULLIF(trim(NEW.raw_user_meta_data->>'family_name'), ''),
            v_full_name
        );
        v_result := budget.f_create_household(
            p_name := left('Familia ' || v_family_name, 100)::VARCHAR,
            p_user_id := NEW.id
        );
        IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
            RAISE EXCEPTION 'Could not create signup household: %', v_result->>'message';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
