\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE owner_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); home uuid; invite jsonb; first_link jsonb; second_link jsonb; old_id uuid; old_token text:=encode(extensions.gen_random_bytes(32),'hex'); recipient text:='retrieve-'||gen_random_uuid()||'@test.invalid'; recipient_id uuid:=gen_random_uuid(); before_count integer;
BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES(owner_id,owner_id||'@test.invalid',now(),'{"full_name":"Link retrieval owner"}'),(outsider,outsider||'@test.invalid',now(),'{"full_name":"Link outsider"}');
 SELECT household_id INTO STRICT home FROM budget.thousehold_member WHERE user_id=owner_id;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 invite:=public.f_create_household_invitation(home,recipient);
 SELECT count(*) INTO before_count FROM family_mcp_private.household_invitation WHERE household_id=home;
 first_link:=public.f_get_household_invitation_link((invite->>'id')::uuid);
 second_link:=public.f_get_household_invitation_link((invite->>'id')::uuid);
 IF first_link->>'token' IS DISTINCT FROM invite->>'token' OR first_link IS DISTINCT FROM second_link OR first_link->>'expires_at' IS DISTINCT FROM invite->>'expires_at' THEN RAISE EXCEPTION 'Retrieval changed original new link or expiry'; END IF;
 IF (SELECT count(*) FROM family_mcp_private.household_invitation WHERE household_id=home)<>before_count THEN RAISE EXCEPTION 'Retrieval created another invitation'; END IF;
 -- Simulate a pre-migration invitation: the original is hashed, the stable share alias differs.
 INSERT INTO family_mcp_private.household_invitation(household_id,email,token_hash,created_by)
 VALUES(home,recipient,encode(extensions.digest(old_token,'sha256'),'hex'),owner_id) RETURNING id INTO old_id;
 first_link:=public.f_get_household_invitation_link(old_id);
 IF first_link->>'token'=old_token THEN RAISE EXCEPTION 'Legacy fixture did not use separate share alias'; END IF;
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES(recipient_id,recipient,now(),'{"full_name":"Invited recipient"}');
 PERFORM set_config('request.jwt.claim.sub',recipient_id::text,true);
 IF public.f_inspect_household_invitation(old_token)->>'status'<>'pending' OR public.f_inspect_household_invitation(first_link->>'token')->>'status'<>'pending' THEN RAISE EXCEPTION 'Original or recovered legacy link no longer valid'; END IF;
 BEGIN PERFORM public.f_get_household_invitation_link(old_id); RAISE EXCEPTION 'Non-admin retrieved link'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Non-admin retrieved link' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 BEGIN PERFORM public.f_get_household_invitation_link(old_id); RAISE EXCEPTION 'Outsider retrieved link'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Outsider retrieved link' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM public.f_revoke_household_invitation(old_id);
 BEGIN PERFORM public.f_get_household_invitation_link(old_id); RAISE EXCEPTION 'Revoked link retrieved'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Revoked link retrieved' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','public.f_get_household_invitation_link(uuid)','EXECUTE') OR has_table_privilege('authenticated','family_mcp_private.household_invitation','SELECT') THEN RAISE EXCEPTION 'Share tokens exposed'; END IF;
 RAISE NOTICE 'PASS: stable retrieval, original new links unchanged, legacy links preserved, no duplicate/expiry extension, admin-only, revocation';
END $$;
ROLLBACK;
