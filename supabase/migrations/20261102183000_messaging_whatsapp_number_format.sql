-- Match E.164 storage (+591...) to Meta sender IDs (591...) without changing stored phone numbers.
-- Telegram IDs and non-phone legacy identifiers remain exact, and ambiguous owners still fail closed.
CREATE FUNCTION budget.f_messaging_channel_code(p_type text,p_code text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
 SELECT CASE WHEN p_type='whatsapp' AND btrim(p_code) ~ '^\+?[1-9][0-9]{7,14}$'
 THEN regexp_replace(btrim(p_code),'^\+','') ELSE btrim(p_code) END;
$$;
REVOKE ALL ON FUNCTION budget.f_messaging_channel_code(text,text) FROM PUBLIC,anon,authenticated;

-- Backend-only identities and tools for the multi-channel laboratory.
-- A channel identifier is meaningful only together with its verified platform.
CREATE OR REPLACE FUNCTION budget.f_messaging_context_lab(p_channel_type text,p_channel_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,budget,public AS $$
DECLARE actor budget.tuser%ROWTYPE; actors integer; homes jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
   RETURN jsonb_build_object('success',false,'error','BACKEND_ONLY');
 END IF;
 IF p_channel_type IS NULL OR p_channel_type NOT IN ('whatsapp','telegram') OR NULLIF(trim(p_channel_code),'') IS NULL THEN
   RETURN jsonb_build_object('success',false,'error','INVALID_CHANNEL');
 END IF;
 SELECT count(DISTINCT u.id) INTO actors FROM budget.tchannel c JOIN budget.tuser u ON u.id=c.user_id
 WHERE c.channel_type=p_channel_type AND budget.f_messaging_channel_code(c.channel_type,c.channel_code)=budget.f_messaging_channel_code(p_channel_type,p_channel_code)
   AND c.status='active' AND c.deleted_at IS NULL AND u.status='active' AND u.deleted_at IS NULL;
 IF actors=0 THEN RETURN jsonb_build_object('success',true,'registered',false); END IF;
 IF actors<>1 THEN RETURN jsonb_build_object('success',false,'error','AMBIGUOUS_CHANNEL'); END IF;
 SELECT u.* INTO actor FROM budget.tchannel c JOIN budget.tuser u ON u.id=c.user_id
 WHERE c.channel_type=p_channel_type AND budget.f_messaging_channel_code(c.channel_type,c.channel_code)=budget.f_messaging_channel_code(p_channel_type,p_channel_code)
   AND c.status='active' AND c.deleted_at IS NULL AND u.status='active' AND u.deleted_at IS NULL LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'currency',h.currency,'role',m.role) ORDER BY h.name),'[]') INTO homes
 FROM budget.thousehold_member m JOIN budget.thousehold h ON h.id=m.household_id
 WHERE m.user_id=actor.id AND m.status='active' AND m.deleted_at IS NULL AND h.status='active' AND h.deleted_at IS NULL;
 RETURN jsonb_build_object('success',true,'registered',true,'user',jsonb_build_object('id',actor.id,'name',actor.full_name,'locale',actor.locale,'households',homes));
END $$;
REVOKE ALL ON FUNCTION budget.f_messaging_context_lab(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION budget.f_messaging_context_lab(text,text) TO service_role;


DO $migration$
DECLARE definition text;
 old_match text:='ch.channel_code=trim(p_channel_code)';
 new_match text:='budget.f_messaging_channel_code(ch.channel_type,ch.channel_code)=budget.f_messaging_channel_code(p_channel_type,p_channel_code)';
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO STRICT definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='budget' AND p.proname='f_register_transaction_ai_lab';
 IF (length(definition)-length(replace(definition,old_match,'')))/length(old_match)<>2 THEN
  RAISE EXCEPTION 'Unexpected laboratory transaction identity checks; review before migration';
 END IF;
 EXECUTE replace(definition,old_match,new_match);
END $migration$;
NOTIFY pgrst,'reload schema';
