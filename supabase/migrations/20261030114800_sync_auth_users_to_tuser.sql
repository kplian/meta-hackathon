-- =====================================================================
-- Step 1: Sync auth.users into budget.tuser automatically
-- =====================================================================

CREATE OR REPLACE FUNCTION budget.f_handle_auth_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = budget, public
AS $$
DECLARE
    v_full_name VARCHAR(100);
BEGIN
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        SPLIT_PART(NEW.email, '@', 1),
        'User'
    )::VARCHAR(100);

    INSERT INTO budget.tuser (
        id,
        full_name,
        email_user,
        locale,
        timezone,
        role,
        status,
        created_at
    )
    VALUES (
        NEW.id,
        v_full_name,
        NEW.email,
        'es',
        'UTC',
        'member',
        'active',
         COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (email_user) DO UPDATE
    SET
        full_name = COALESCE(EXCLUDED.full_name, budget.tuser.full_name),
        updated_at = now();

    -- Automatically link user to default household if it exists
    IF EXISTS (SELECT 1 FROM budget.thousehold WHERE id = '22222222-2222-4222-8222-222222222201') THEN
        INSERT INTO budget.thousehold_member (household_id, user_id, role, member_type, status)
        VALUES ('22222222-2222-4222-8222-222222222201', NEW.id, 'admin', 'dad', 'active')
        ON CONFLICT (household_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger on auth.users whenever a new user signs up or signs in via OAuth
DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;
CREATE TRIGGER on_auth_user_created_or_updated
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION budget.f_handle_auth_user_sync();

-- Backfill any existing users in auth.users into budget.tuser
INSERT INTO budget.tuser (
    id,
    full_name,
    email_user,
    locale,
    timezone,
    role,
    status,
    created_at
)
SELECT
    au.id,
    COALESCE(
        NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),
        SPLIT_PART(au.email, '@', 1),
        'User'
    )::VARCHAR(100) AS full_name,
    au.email::VARCHAR(100) AS email_user,
    'es',
    'UTC',
    'member',
    'active',
    COALESCE(au.created_at, now())
FROM auth.users au
WHERE au.email IS NOT NULL
ON CONFLICT (email_user) DO UPDATE
SET
    full_name = COALESCE(EXCLUDED.full_name, budget.tuser.full_name),
    updated_at = now();

