-- Recoverable share links remain private and require household-admin authorization.
-- Existing invitations get a stable additional share token; original hashed links
-- remain valid, and neither their expiry nor acceptance state is changed.
ALTER TABLE family_mcp_private.household_invitation ADD COLUMN share_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32),'hex');
CREATE UNIQUE INDEX household_invitation_share_token ON family_mcp_private.household_invitation(share_token);
DO $patch$
DECLARE definition text; anchor text;
BEGIN
 SELECT pg_get_functiondef('public.f_create_household_invitation(uuid,text,uuid,text)'::regprocedure) INTO definition;
 anchor:='member_type,token_hash,created_by)';
 IF position(anchor in definition)=0 THEN RAISE EXCEPTION 'Unexpected invitation insert'; END IF;
 definition:=replace(definition,anchor,'member_type,token_hash,created_by,share_token)');
 definition:=replace(definition,'encode(extensions.digest(token,''sha256''),''hex''),actor) RETURNING','encode(extensions.digest(token,''sha256''),''hex''),actor,token) RETURNING');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.f_inspect_household_invitation(text)'::regprocedure) INTO definition;
 anchor:='WHERE token_hash=encode(extensions.digest(p_token,''sha256''),''hex'')';
 IF position(anchor in definition)=0 THEN RAISE EXCEPTION 'Unexpected invitation token lookup'; END IF;
 EXECUTE replace(definition,anchor,anchor||' OR share_token=p_token');
END $patch$;
CREATE FUNCTION public.f_get_household_invitation_link(p_invitation_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation family_mcp_private.household_invitation%ROWTYPE;
BEGIN
 SELECT i.* INTO invitation FROM family_mcp_private.household_invitation i JOIN budget.thousehold h ON h.id=i.household_id
 WHERE i.id=p_invitation_id AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND h.status='active' AND h.deleted_at IS NULL
 AND EXISTS(SELECT 1 FROM budget.thousehold_member m WHERE m.household_id=i.household_id AND m.user_id=auth.uid() AND m.role='admin' AND m.status='active' AND m.deleted_at IS NULL);
 IF invitation.id IS NULL THEN RAISE EXCEPTION 'INVITATION_NOT_AVAILABLE'; END IF;
 RETURN jsonb_build_object('id',invitation.id,'token',invitation.share_token,'email',invitation.email,'expires_at',invitation.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.f_get_household_invitation_link(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_get_household_invitation_link(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
