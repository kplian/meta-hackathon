-- Additional households use the same provisioning triggers as signup.
-- Actor identity comes exclusively from the registered messaging channel.
CREATE TABLE family_mcp_private.household_creation_request (
 actor_id uuid NOT NULL REFERENCES budget.tuser(id) ON DELETE CASCADE,
 request_key text NOT NULL,
 name text NOT NULL,
 currency text NOT NULL,
 household_id uuid NOT NULL REFERENCES budget.thousehold(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_key)
);
REVOKE ALL ON family_mcp_private.household_creation_request FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION family_mcp_private.create_household(p_actor uuid,p_payload jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,budget,public AS $$
DECLARE label text; money text; home uuid; business uuid; previous family_mcp_private.household_creation_request;
 homes jsonb; created boolean:=false;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Backend only'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('name','currency')) THEN
  RAISE EXCEPTION 'Household creation accepts only name and currency';
 END IF;
 IF jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'currency') IS DISTINCT FROM 'string' THEN
  RAISE EXCEPTION 'Specify household name and currency';
 END IF;
 label:=btrim(p_payload->>'name'); money:=btrim(p_payload->>'currency');
 IF label='' OR length(label)>100 THEN RAISE EXCEPTION 'Invalid household name'; END IF;
 IF money!~'^[A-Z]{3}$' THEN RAISE EXCEPTION 'Invalid household currency'; END IF;
 IF NULLIF(btrim(p_request_key),'') IS NULL OR length(p_request_key)>300 THEN RAISE EXCEPTION 'A backend request key is required'; END IF;
 -- Serialize duplicate name checks and request replay for this authenticated actor.
 PERFORM 1 FROM budget.tuser WHERE id=p_actor AND status='active' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.thousehold_member m JOIN budget.thousehold h ON h.id=m.household_id
  WHERE m.user_id=p_actor AND m.role='admin' AND m.status='active' AND m.deleted_at IS NULL
   AND h.status='active' AND h.deleted_at IS NULL) THEN RAISE EXCEPTION 'Administrator required to create an additional household'; END IF;
 SELECT * INTO previous FROM family_mcp_private.household_creation_request WHERE actor_id=p_actor AND request_key=p_request_key;
 IF FOUND THEN
  IF previous.name<>label OR previous.currency<>money THEN RAISE EXCEPTION 'Request key already used with different household data'; END IF;
  home:=previous.household_id;
  IF NOT EXISTS(SELECT 1 FROM budget.thousehold h JOIN budget.thousehold_member m ON m.household_id=h.id
   WHERE h.id=home AND m.user_id=p_actor AND m.role='admin' AND h.status='active' AND h.deleted_at IS NULL
    AND m.status='active' AND m.deleted_at IS NULL) THEN RAISE EXCEPTION 'Previously created household is no longer accessible'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM budget.thousehold h JOIN budget.thousehold_member m ON m.household_id=h.id
   WHERE m.user_id=p_actor AND lower(btrim(h.name))=lower(label) AND h.status='active' AND h.deleted_at IS NULL
    AND m.status='active' AND m.deleted_at IS NULL) THEN RAISE EXCEPTION 'You already have a household with this name'; END IF;
  SELECT id INTO STRICT business FROM budget.tbusiness_type WHERE code='household';
  INSERT INTO budget.thousehold(business_type_id,name,currency,created_by,status)
   VALUES(business,label,money,p_actor,'active') RETURNING id INTO home;
  -- Provisioning must have created the chart and the creator's personal auxiliar.
  IF NOT EXISTS(SELECT 1 FROM budget.thousehold_member WHERE household_id=home AND user_id=p_actor
   AND role='admin' AND auxiliar_id IS NOT NULL AND status='active' AND deleted_at IS NULL)
   OR NOT EXISTS(SELECT 1 FROM budget.taccount WHERE household_id=home AND code='110' AND currency=money)
   OR NOT EXISTS(SELECT 1 FROM budget.tbudget_type WHERE household_id=home AND status='active' AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'Household provisioning incomplete';
  END IF;
  INSERT INTO family_mcp_private.household_creation_request(actor_id,request_key,name,currency,household_id)
   VALUES(p_actor,p_request_key,label,money,home);
  created:=true;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'currency',h.currency,'role',m.role) ORDER BY h.name,h.id),'[]') INTO homes
 FROM budget.thousehold_member m JOIN budget.thousehold h ON h.id=m.household_id
 WHERE m.user_id=p_actor AND m.status='active' AND m.deleted_at IS NULL AND h.status='active' AND h.deleted_at IS NULL;
 RETURN jsonb_build_object('household',(SELECT jsonb_build_object('id',h.id,'name',h.name,'currency',h.currency,'role','admin','setup_completed_at',h.setup_completed_at) FROM budget.thousehold h WHERE h.id=home),
  'created',created,'households',homes);
END $$;
REVOKE ALL ON FUNCTION family_mcp_private.create_household(uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

-- Creation has no existing target household; route before normal selection.
-- All other operations retain the one-household default / multi-household guard.
DO $migration$
DECLARE definition text;
 anchor text:='IF p_area=''household'' AND p_operation=''list'' THEN RETURN jsonb_build_object(''success'',true,''data'',homes); END IF;';
BEGIN
 SELECT pg_get_functiondef('budget.f_family_mcp(text,text,text,text,jsonb,text)'::regprocedure) INTO definition;
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'MCP gateway changed; review household creation routing'; END IF;
 definition:=replace(definition,anchor,anchor||E'\n IF p_area=''household'' AND p_operation=''create'' THEN\n  result:=family_mcp_private.create_household(actor,p_payload,p_request_key);\n  RETURN jsonb_build_object(''success'',true,''data'',result);\n END IF;');
 EXECUTE definition;
END $migration$;
NOTIFY pgrst,'reload schema';
