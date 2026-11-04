-- Email-bound, revocable household invitations. No email or WhatsApp is sent by these RPCs.
CREATE TABLE family_mcp_private.household_invitation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES budget.thousehold(id) ON DELETE CASCADE,
 email text NOT NULL CHECK(email=lower(btrim(email)) AND length(email)<=254),
 member_id uuid REFERENCES budget.thousehold_member(id) ON DELETE CASCADE,
 member_type text NOT NULL DEFAULT 'other' CHECK(member_type IN('dad','mom','son','other')),
 token_hash text NOT NULL UNIQUE,
 created_by uuid NOT NULL REFERENCES budget.tuser(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 revoked_at timestamptz,accepted_at timestamptz,
 accepted_by uuid REFERENCES budget.tuser(id) ON DELETE SET NULL
);
CREATE INDEX ON family_mcp_private.household_invitation(email,expires_at);
REVOKE ALL ON family_mcp_private.household_invitation FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.f_household_access(p_household_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); admin boolean; members jsonb; invites jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM budget.thousehold_member m JOIN budget.thousehold h ON h.id=m.household_id WHERE m.household_id=p_household_id AND m.user_id=actor AND m.status='active' AND m.deleted_at IS NULL AND h.status='active' AND h.deleted_at IS NULL) THEN RAISE EXCEPTION 'HOUSEHOLD_ACCESS_DENIED'; END IF;
 SELECT role='admin' INTO admin FROM budget.thousehold_member WHERE household_id=p_household_id AND user_id=actor AND status='active' AND deleted_at IS NULL;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',u.full_name,'member_type',m.member_type,'registered',a.id IS NOT NULL) ORDER BY u.full_name),'[]') INTO members
 FROM budget.thousehold_member m JOIN budget.tuser u ON u.id=m.user_id LEFT JOIN auth.users a ON a.id=u.id
 WHERE m.household_id=p_household_id AND m.status='active' AND m.deleted_at IS NULL;
 IF admin THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'expires_at',i.expires_at) ORDER BY i.created_at DESC),'[]') INTO invites
 FROM family_mcp_private.household_invitation i WHERE i.household_id=p_household_id AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now(); END IF;
 RETURN jsonb_build_object('admin',admin,'members',members,'invitations',coalesce(invites,'[]'::jsonb));
END $$;

CREATE FUNCTION public.f_create_household_invitation(p_household_id uuid,p_email text,p_member_id uuid DEFAULT NULL,p_member_type text DEFAULT 'other') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); recipient_email text:=lower(btrim(p_email)); token text; invite uuid;
BEGIN
 PERFORM 1 FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM budget.thousehold_member WHERE household_id=p_household_id AND user_id=actor AND role='admin' AND status='active' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 IF recipient_email IS NULL OR length(recipient_email)>254 OR recipient_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'INVALID_EMAIL'; END IF;
 IF p_member_type IS NULL OR p_member_type NOT IN('dad','mom','son','other') THEN RAISE EXCEPTION 'INVALID_MEMBER_TYPE'; END IF;
 IF EXISTS(SELECT 1 FROM budget.thousehold_member m JOIN budget.tuser u ON u.id=m.user_id WHERE m.household_id=p_household_id AND lower(u.email_user)=recipient_email AND m.status='active' AND m.deleted_at IS NULL) THEN RAISE EXCEPTION 'ALREADY_MEMBER'; END IF;
 IF p_member_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM budget.thousehold_member m WHERE m.id=p_member_id AND m.household_id=p_household_id AND m.status='active' AND m.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id=m.user_id)) THEN RAISE EXCEPTION 'INVALID_MEMBER'; END IF;
 IF (SELECT count(*) FROM family_mcp_private.household_invitation WHERE household_id=p_household_id AND created_at>now()-interval '1 hour')>=20 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 UPDATE family_mcp_private.household_invitation SET revoked_at=now() WHERE household_id=p_household_id AND accepted_at IS NULL AND revoked_at IS NULL AND (email=lower(btrim(p_email)) OR (p_member_id IS NOT NULL AND member_id=p_member_id));
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO family_mcp_private.household_invitation(household_id,email,member_id,member_type,token_hash,created_by)
 VALUES(p_household_id,recipient_email,p_member_id,p_member_type,encode(extensions.digest(token,'sha256'),'hex'),actor) RETURNING id INTO invite;
 RETURN jsonb_build_object('id',invite,'token',token,'expires_at',now()+interval '7 days');
END $$;

CREATE FUNCTION public.f_revoke_household_invitation(p_invitation_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE family_mcp_private.household_invitation i SET revoked_at=now() WHERE i.id=p_invitation_id AND i.accepted_at IS NULL
 AND EXISTS(SELECT 1 FROM budget.thousehold_member m WHERE m.household_id=i.household_id AND m.user_id=auth.uid() AND m.role='admin' AND m.status='active' AND m.deleted_at IS NULL);
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_AVAILABLE'; END IF;
END $$;

CREATE FUNCTION public.f_my_household_invitations() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'household_name',h.name,'expires_at',i.expires_at) ORDER BY i.created_at),'[]') INTO result
 FROM family_mcp_private.household_invitation i JOIN budget.thousehold h ON h.id=i.household_id JOIN auth.users a ON a.id=auth.uid()
 WHERE i.email=lower(a.email) AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>now() AND h.status='active' AND h.deleted_at IS NULL
 AND EXISTS(SELECT 1 FROM budget.thousehold_member m WHERE m.household_id=i.household_id AND m.user_id=i.created_by AND m.role='admin' AND m.status='active' AND m.deleted_at IS NULL);
 RETURN result;
END $$;

CREATE FUNCTION public.f_accept_household_invitation(p_invitation_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); email text; invitation family_mcp_private.household_invitation%ROWTYPE; old_member budget.thousehold_member%ROWTYPE; new_member uuid; temporary_aux uuid;
BEGIN
 SELECT lower(a.email) INTO email FROM auth.users a JOIN budget.tuser u ON u.id=a.id WHERE a.id=actor AND a.email_confirmed_at IS NOT NULL AND u.status='active' AND u.deleted_at IS NULL;
 IF email IS NULL THEN RAISE EXCEPTION 'VERIFIED_EMAIL_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
 SELECT * INTO invitation FROM family_mcp_private.household_invitation WHERE id=p_invitation_id FOR UPDATE;
 IF invitation.email IS DISTINCT FROM email THEN RAISE EXCEPTION 'INVITATION_NOT_AVAILABLE'; END IF;
 IF invitation.accepted_by=actor AND invitation.accepted_at IS NOT NULL THEN RETURN invitation.household_id; END IF;
 IF invitation.id IS NULL OR invitation.revoked_at IS NOT NULL OR invitation.accepted_at IS NOT NULL OR invitation.expires_at<=now()
 OR NOT EXISTS(SELECT 1 FROM budget.thousehold h JOIN budget.thousehold_member m ON m.household_id=h.id WHERE h.id=invitation.household_id AND h.status='active' AND h.deleted_at IS NULL AND m.user_id=invitation.created_by AND m.role='admin' AND m.status='active' AND m.deleted_at IS NULL) THEN RAISE EXCEPTION 'INVITATION_NOT_AVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM budget.thousehold_member WHERE household_id=invitation.household_id AND user_id=actor) THEN RAISE EXCEPTION 'ALREADY_MEMBER'; END IF;
 IF invitation.member_id IS NOT NULL THEN
  SELECT * INTO old_member FROM budget.thousehold_member m WHERE m.id=invitation.member_id AND m.household_id=invitation.household_id AND m.status='active' AND m.deleted_at IS NULL FOR UPDATE;
  IF old_member.id IS NULL OR EXISTS(SELECT 1 FROM auth.users WHERE id=old_member.user_id) THEN RAISE EXCEPTION 'INVALID_MEMBER'; END IF;
 END IF;
 INSERT INTO budget.thousehold_member(household_id,user_id,role,member_type,auxiliar_id,created_by)
 VALUES(invitation.household_id,actor,'member',coalesce(old_member.member_type,invitation.member_type),old_member.auxiliar_id,actor) RETURNING id,auxiliar_id INTO new_member,temporary_aux;
 IF old_member.id IS NOT NULL THEN
  UPDATE budget.thousehold_member SET auxiliar_id=old_member.auxiliar_id WHERE id=new_member;
  DELETE FROM budget.tauxiliar WHERE id=temporary_aux AND id IS DISTINCT FROM old_member.auxiliar_id;
  UPDATE budget.tmember_health_profile SET household_member_id=new_member WHERE household_member_id=old_member.id;
  UPDATE budget.tincome_source SET household_member_id=new_member WHERE household_member_id=old_member.id;
  UPDATE budget.tasset_yield_settings SET notify_user_id=actor WHERE household_id=invitation.household_id AND notify_user_id=old_member.user_id;
  UPDATE budget.thousehold_member SET status='inactive',deleted_at=now(),deleted_by=actor,updated_at=now(),updated_by=actor WHERE id=old_member.id;
 END IF;
 UPDATE family_mcp_private.household_invitation SET accepted_at=now(),accepted_by=actor WHERE id=invitation.id;
 RETURN invitation.household_id;
END $$;

CREATE FUNCTION public.f_decline_household_invitation(p_invitation_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE family_mcp_private.household_invitation i SET revoked_at=now() FROM auth.users a WHERE a.id=auth.uid() AND a.email_confirmed_at IS NOT NULL AND i.email=lower(a.email) AND i.id=p_invitation_id AND i.accepted_at IS NULL AND i.revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_AVAILABLE'; END IF;
END $$;

-- New invited accounts wait for acceptance instead of provisioning another household.
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('budget.f_handle_auth_user_sync()'::regprocedure) INTO definition;
 definition:=replace(definition,$old$IF TG_OP = 'INSERT' AND NOT EXISTS ($old$, $new$IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM family_mcp_private.household_invitation i JOIN budget.thousehold h ON h.id=i.household_id WHERE i.email=lower(NEW.email) AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>now() AND h.status='active' AND h.deleted_at IS NULL AND EXISTS(SELECT 1 FROM budget.thousehold_member m WHERE m.household_id=i.household_id AND m.user_id=i.created_by AND m.role='admin' AND m.status='active' AND m.deleted_at IS NULL)) AND NOT EXISTS ($new$);
 EXECUTE definition;
END $patch$;

CREATE FUNCTION public.f_ensure_my_household() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); home uuid; name text; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
 SELECT household_id INTO home FROM budget.thousehold_member m JOIN budget.thousehold h ON h.id=m.household_id WHERE m.user_id=actor AND m.status='active' AND m.deleted_at IS NULL AND h.status='active' AND h.deleted_at IS NULL LIMIT 1;
 IF home IS NOT NULL THEN RETURN home; END IF;
 IF jsonb_array_length(public.f_my_household_invitations())>0 THEN RETURN NULL; END IF;
 SELECT full_name INTO STRICT name FROM budget.tuser WHERE id=actor AND status='active' AND deleted_at IS NULL;
 result:=budget.f_create_household(p_name:=left('Familia '||name,100)::varchar,p_user_id:=actor);
 IF result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'HOUSEHOLD_CREATION_FAILED'; END IF;
 SELECT household_id INTO home FROM budget.thousehold_member WHERE user_id=actor AND status='active' AND deleted_at IS NULL LIMIT 1;
 RETURN home;
END $$;

DO $grants$
DECLARE sig regprocedure;
BEGIN
 FOREACH sig IN ARRAY ARRAY['public.f_household_access(uuid)'::regprocedure,'public.f_create_household_invitation(uuid,text,uuid,text)'::regprocedure,'public.f_revoke_household_invitation(uuid)'::regprocedure,'public.f_my_household_invitations()'::regprocedure,'public.f_accept_household_invitation(uuid)'::regprocedure,'public.f_decline_household_invitation(uuid)'::regprocedure,'public.f_ensure_my_household()'::regprocedure]
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',sig); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',sig); END LOOP;
END $grants$;
NOTIFY pgrst,'reload schema';

CREATE FUNCTION public.f_inspect_household_invitation(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation family_mcp_private.household_invitation%ROWTYPE; email text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
 SELECT * INTO invitation FROM family_mcp_private.household_invitation WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 IF invitation.id IS NULL OR invitation.revoked_at IS NOT NULL OR invitation.expires_at<=now() THEN RETURN jsonb_build_object('status','invalid'); END IF;
 SELECT lower(a.email) INTO email FROM auth.users a WHERE a.id=auth.uid();
 IF invitation.email IS DISTINCT FROM email THEN RETURN jsonb_build_object('status','wrong_email'); END IF;
 IF invitation.accepted_at IS NOT NULL THEN RETURN jsonb_build_object('status',CASE WHEN invitation.accepted_by=auth.uid() THEN 'accepted' ELSE 'invalid' END); END IF;
 RETURN jsonb_build_object('status','pending','id',invitation.id);
END $$;
REVOKE ALL ON FUNCTION public.f_inspect_household_invitation(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_inspect_household_invitation(text) TO authenticated;
NOTIFY pgrst,'reload schema';
