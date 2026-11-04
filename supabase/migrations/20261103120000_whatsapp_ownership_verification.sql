-- Ownership linking is deterministic and happens before the assistant.
CREATE TABLE family_mcp_private.whatsapp_link_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 bot_phone text NOT NULL CHECK(bot_phone ~ '^[1-9][0-9]{7,14}$'),
 account_id text NOT NULL CHECK(account_id ~ '^[0-9]+$')
);
-- Existing Meta bot, public routing identifiers (not credentials).
INSERT INTO family_mcp_private.whatsapp_link_settings VALUES(true,'59144660408','814563555083416');
CREATE TABLE family_mcp_private.whatsapp_link_challenge (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES budget.tuser(id) ON DELETE CASCADE,
 channel_id uuid NOT NULL REFERENCES budget.tchannel(id) ON DELETE CASCADE,
 phone text NOT NULL,
 token_hash text NOT NULL UNIQUE,
 locale text NOT NULL CHECK(locale IN ('es','en','pt')),
 account_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 consumed_at timestamptz,
 invalidated_at timestamptz
);
CREATE INDEX ON family_mcp_private.whatsapp_link_challenge(user_id,created_at);
REVOKE ALL ON family_mcp_private.whatsapp_link_settings,family_mcp_private.whatsapp_link_challenge FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE budget.tchannel ADD COLUMN verified_at timestamptz;
CREATE UNIQUE INDEX channel_verified_whatsapp_owner ON budget.tchannel
 ((budget.f_messaging_channel_code(channel_type,channel_code)))
 WHERE channel_type='whatsapp' AND status='active' AND deleted_at IS NULL AND verified_at IS NOT NULL;
-- Clients cannot manufacture proof by writing config_json or verified_at directly.
CREATE POLICY whatsapp_server_insert ON budget.tchannel AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(channel_type<>'whatsapp');
CREATE POLICY whatsapp_server_update ON budget.tchannel AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(channel_type<>'whatsapp') WITH CHECK(channel_type<>'whatsapp');
CREATE POLICY whatsapp_server_delete ON budget.tchannel AS RESTRICTIVE FOR DELETE TO authenticated
 USING(channel_type<>'whatsapp');
CREATE OR REPLACE FUNCTION public.f_set_my_whatsapp(p_phone text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); phone text:=nullif(btrim(p_phone),'');
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF phone IS NOT NULL AND phone !~ '^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'Invalid international phone'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
 IF phone IS NOT NULL AND EXISTS(SELECT 1 FROM budget.tchannel WHERE user_id=actor AND channel_type='whatsapp'
  AND channel_code=phone AND status='active' AND deleted_at IS NULL) THEN RETURN; END IF;
 UPDATE family_mcp_private.whatsapp_link_challenge SET invalidated_at=now() WHERE user_id=actor AND consumed_at IS NULL AND invalidated_at IS NULL;
 UPDATE budget.tchannel SET status='inactive',updated_at=now(),updated_by=actor
 WHERE user_id=actor AND channel_type='whatsapp' AND status='active' AND deleted_at IS NULL;
 IF phone IS NOT NULL THEN
  INSERT INTO budget.tchannel(user_id,channel_type,channel_code,config_json,created_by)
  VALUES(actor,'whatsapp',phone,'{"verified":false}',actor);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.f_set_my_whatsapp(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_set_my_whatsapp(text) TO authenticated;

CREATE FUNCTION public.f_begin_whatsapp_verification(p_phone text,p_locale text DEFAULT 'es') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); channel budget.tchannel%ROWTYPE; token text; expiry timestamptz:=now()+interval '10 minutes'; settings family_mcp_private.whatsapp_link_settings%ROWTYPE;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
 SELECT * INTO STRICT settings FROM family_mcp_private.whatsapp_link_settings WHERE singleton;
 IF (SELECT count(*) FROM family_mcp_private.whatsapp_link_challenge WHERE user_id=actor AND created_at>now()-interval '1 hour')>=5
  OR EXISTS(SELECT 1 FROM family_mcp_private.whatsapp_link_challenge WHERE user_id=actor AND created_at>now()-interval '1 minute') THEN
  RETURN jsonb_build_object('success',false,'error','RATE_LIMITED');
 END IF;
 PERFORM public.f_set_my_whatsapp(p_phone);
 SELECT * INTO STRICT channel FROM budget.tchannel WHERE user_id=actor AND channel_type='whatsapp' AND channel_code=btrim(p_phone) AND status='active' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1;
 IF channel.verified_at IS NOT NULL THEN RETURN jsonb_build_object('success',true,'verified',true); END IF;
 UPDATE family_mcp_private.whatsapp_link_challenge SET invalidated_at=now() WHERE user_id=actor AND consumed_at IS NULL AND invalidated_at IS NULL;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO family_mcp_private.whatsapp_link_challenge(user_id,channel_id,phone,token_hash,locale,account_id,expires_at)
 VALUES(actor,channel.id,channel.channel_code,encode(extensions.digest(token,'sha256'),'hex'),CASE WHEN p_locale IN ('es','en','pt') THEN p_locale ELSE 'es' END,settings.account_id,expiry);
 RETURN jsonb_build_object('success',true,'verified',false,'message','LINK '||token,'bot_phone',settings.bot_phone,'expires_at',expiry);
END $$;
REVOKE ALL ON FUNCTION public.f_begin_whatsapp_verification(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_begin_whatsapp_verification(text,text) TO authenticated;

CREATE FUNCTION public.f_my_whatsapp_verification() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE channel budget.tchannel%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO channel FROM budget.tchannel WHERE user_id=auth.uid() AND channel_type='whatsapp' AND status='active' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1;
 RETURN jsonb_build_object('phone',channel.channel_code,'verified',channel.verified_at IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.f_my_whatsapp_verification() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_my_whatsapp_verification() TO authenticated;

-- All backend entry points must require ownership proof, including MCP and the legacy lab transaction tool.
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('budget.f_messaging_context_lab(text,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'AND c.status=''active''','AND (c.channel_type<>''whatsapp'' OR c.verified_at IS NOT NULL) AND c.status=''active''');
 EXECUTE definition;
 SELECT pg_get_functiondef('budget.f_register_transaction_ai_lab(text,text,text,text,numeric,text,date,character varying,json,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'AND ch.status=''active''','AND (ch.channel_type<>''whatsapp'' OR ch.verified_at IS NOT NULL) AND ch.status=''active''');
 EXECUTE definition;
END $patch$;

-- Called ONLY from the authenticated native trigger, using its actual sender/account.
CREATE FUNCTION budget.f_messaging_ingress_lab(p_channel_type text,p_channel_code text,p_message text DEFAULT '',p_account_id text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE challenge family_mcp_private.whatsapp_link_challenge%ROWTYPE; token text; actor uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RETURN jsonb_build_object('success',false,'error','BACKEND_ONLY'); END IF;
 IF p_channel_type='whatsapp' AND btrim(p_message) ~* '^LINK\M' THEN
  token:=substring(btrim(p_message) from '^LINK ([a-f0-9]{64})$');
  SELECT * INTO challenge FROM family_mcp_private.whatsapp_link_challenge WHERE token_hash=encode(extensions.digest(token,'sha256'),'hex');
  IF challenge.id IS NULL THEN RETURN jsonb_build_object('success',true,'verification',jsonb_build_object('handled',true,'verified',false)); END IF;
  -- Same lock order as begin/change: owner, phone, challenge. Concurrent confirmations cannot steal a number.
  PERFORM pg_advisory_xact_lock(hashtextextended(challenge.user_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('wa:'||budget.f_messaging_channel_code('whatsapp',challenge.phone),0));
  SELECT * INTO challenge FROM family_mcp_private.whatsapp_link_challenge WHERE id=challenge.id FOR UPDATE;
  IF challenge.consumed_at IS NOT NULL OR challenge.invalidated_at IS NOT NULL OR challenge.expires_at<=now()
   OR challenge.account_id IS DISTINCT FROM p_account_id
   OR budget.f_messaging_channel_code('whatsapp',challenge.phone) IS DISTINCT FROM budget.f_messaging_channel_code('whatsapp',p_channel_code)
   OR NOT EXISTS(SELECT 1 FROM budget.tchannel c JOIN budget.tuser u ON u.id=c.user_id WHERE c.id=challenge.channel_id AND c.status='active' AND c.deleted_at IS NULL AND u.status='active' AND u.deleted_at IS NULL)
   OR EXISTS(SELECT 1 FROM budget.tchannel c WHERE c.channel_type='whatsapp' AND c.status='active' AND c.deleted_at IS NULL AND c.verified_at IS NOT NULL AND c.user_id<>challenge.user_id AND budget.f_messaging_channel_code('whatsapp',c.channel_code)=budget.f_messaging_channel_code('whatsapp',challenge.phone)) THEN
    RETURN jsonb_build_object('success',true,'verification',jsonb_build_object('handled',true,'verified',false,'locale',challenge.locale));
  END IF;
  UPDATE budget.tchannel SET verified_at=now(),config_json=((coalesce(config_json,'{}')::jsonb)||'{"verified":true}'::jsonb)::text,updated_at=now() WHERE id=challenge.channel_id;
  UPDATE family_mcp_private.whatsapp_link_challenge SET consumed_at=now() WHERE id=challenge.id;
  RETURN jsonb_build_object('success',true,'verification',jsonb_build_object('handled',true,'verified',true,'locale',challenge.locale));
 END IF;
 RETURN budget.f_messaging_context_lab(p_channel_type,p_channel_code);
END $$;
REVOKE ALL ON FUNCTION budget.f_messaging_ingress_lab(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION budget.f_messaging_ingress_lab(text,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
