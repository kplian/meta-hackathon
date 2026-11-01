-- Family profiles can exist without an Auth login. The reserved .invalid address
-- is an internal unique identifier required by the existing tuser schema.
CREATE OR REPLACE FUNCTION public.f_add_household_member(
    p_household_id UUID, p_name TEXT, p_member_type TEXT DEFAULT 'other'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = budget, public
AS $$
DECLARE
    v_user_id UUID := gen_random_uuid();
    v_member_id UUID;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM budget.thousehold_member
        WHERE household_id = p_household_id AND user_id = auth.uid()
          AND role = 'admin' AND status = 'active' AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Only a household administrator can add members';
    END IF;
    IF NULLIF(trim(p_name), '') IS NULL OR length(trim(p_name)) > 100 THEN
        RAISE EXCEPTION 'Member name must contain between 1 and 100 characters';
    END IF;
    IF p_member_type IS NULL OR p_member_type NOT IN ('dad', 'mom', 'son', 'other') THEN
        RAISE EXCEPTION 'Invalid member type';
    END IF;
    INSERT INTO budget.tuser (id, full_name, email_user, created_by)
    VALUES (v_user_id, trim(p_name), v_user_id::text || '@members.invalid', auth.uid());
    INSERT INTO budget.thousehold_member (household_id, user_id, member_type, role, created_by)
    VALUES (p_household_id, v_user_id, p_member_type, 'member', auth.uid())
    RETURNING id INTO v_member_id;
    RETURN v_member_id;
END;
$$;
REVOKE ALL ON FUNCTION public.f_add_household_member(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_add_household_member(UUID, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
