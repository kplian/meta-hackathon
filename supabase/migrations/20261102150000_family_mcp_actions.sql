-- Family MCP: backend-only actions over the same business rules as the app.
-- No forged user JWTs and no changes to the app's existing RPC definitions.
CREATE SCHEMA IF NOT EXISTS family_mcp_private;
REVOKE ALL ON SCHEMA family_mcp_private FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION family_mcp_private.actor() RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE actor text:=current_setting('family_mcp.actor',true);
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NULLIF(actor,'') IS NULL THEN
   RAISE EXCEPTION 'MCP actor context is required';
 END IF;
 RETURN actor::uuid;
END $$;
CREATE FUNCTION family_mcp_private.is_member(p_household uuid,p_admin boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,budget,public AS $$
 SELECT EXISTS(SELECT 1 FROM budget.thousehold_member m JOIN budget.thousehold h ON h.id=m.household_id
 WHERE m.household_id=p_household AND m.user_id=family_mcp_private.actor()
 AND m.status='active' AND m.deleted_at IS NULL AND h.status='active' AND h.deleted_at IS NULL
 AND (NOT p_admin OR m.role='admin'));
$$;
CREATE FUNCTION family_mcp_private.health_access(p_household uuid,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT family_mcp_private.is_member(p_household,p_write) $$;

-- Isolated snapshots: changes to future app RPCs must be reviewed and resynced.
-- Dependencies with authorization checks are also redirected into this schema.
DO $migration$
DECLARE r record; definition text; fn text; found integer:=0;
 names text[]:=ARRAY['f_add_household_member','f_register_household_asset','f_configure_asset_yield',
 'f_investment_overview','f_move_investment','f_create_saving_vault','f_saving_vaults','f_transfer_saving_vault',
 'f_household_wealth_report','f_monthly_pyramid_dashboard','f_closed_month_savings_report','f_member_expenses_report',
 'f_upsert_member_health_profile','f_get_family_health_context','f_get_meal_plan','f_save_meal_plan','f_set_household_preference'];
BEGIN
 FOR r IN SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=ANY(names)
 LOOP
   found:=found+1;
   definition:=pg_get_functiondef(r.oid);
   definition:=replace(definition,'auth.uid()','family_mcp_private.actor()');
   definition:=replace(definition,'budget.f_is_household_member(','family_mcp_private.is_member(');
   definition:=replace(definition,'budget.f_health_access(','family_mcp_private.health_access(');
   FOREACH fn IN ARRAY names LOOP
     definition:=replace(definition,'public.'||fn||'(','family_mcp_private.'||fn||'(');
   END LOOP;
   EXECUTE definition;
   EXECUTE format('REVOKE ALL ON FUNCTION family_mcp_private.%I(%s) FROM PUBLIC,anon,authenticated,service_role',r.proname,oidvectortypes(r.proargtypes));
 END LOOP;
 IF found<>cardinality(names) THEN RAISE EXCEPTION 'Missing or overloaded app RPCs: install the health migrations and review MCP snapshots'; END IF;
END $migration$;

-- Bind only declared parameters to a fixed, owner-only business function.
-- The gateway chooses the function; the model cannot supply its name or SQL.
CREATE FUNCTION family_mcp_private.invoke(p_function regprocedure,p_values jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE fn record; parameters text[]:='{}'; argument text; data_key text; typ text; i integer;
BEGIN
 SELECT p.*,n.nspname INTO STRICT fn FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid=p_function;
 IF fn.nspname<>'family_mcp_private' THEN RAISE EXCEPTION 'Invalid private operation'; END IF;
 FOR i IN 1..fn.pronargs LOOP
   argument:=fn.proargnames[i]; data_key:=regexp_replace(argument,'^p_','');
   IF p_values ? data_key THEN
     typ:=format_type(fn.proargtypes[i-1],NULL);
     parameters:=parameters||format('%I => (($1 %s %L)::%s)',argument,
       CASE WHEN typ IN ('json','jsonb') THEN '->' ELSE '->>' END,data_key,typ);
   ELSIF i<=fn.pronargs-fn.pronargdefaults THEN
     RAISE EXCEPTION 'Missing field: %',data_key;
   END IF;
 END LOOP;
 EXECUTE format('SELECT to_jsonb(family_mcp_private.%I(%s))',fn.proname,array_to_string(parameters,',')) INTO p_values USING p_values;
 RETURN p_values;
END $$;

CREATE FUNCTION budget.f_family_mcp(p_channel_type text,p_channel_code text,p_area text,p_operation text,p_payload jsonb DEFAULT '{}',p_request_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,budget,public AS $$
DECLARE ctx jsonb; actor uuid; home uuid; homes jsonb; result jsonb; selected record;
 previous_actor text:=current_setting('family_mcp.actor',true); payload jsonb; target uuid; member uuid;
 amount numeric; aux_code text; member_kind text; source budget.tincome_source%ROWTYPE;
 fn regprocedure; write_access boolean:=false;
BEGIN
 ctx:=budget.f_messaging_context_lab(p_channel_type,p_channel_code);
 IF ctx->>'success' IS DISTINCT FROM 'true' THEN RETURN ctx; END IF;
 IF ctx->>'registered' IS DISTINCT FROM 'true' THEN RETURN jsonb_build_object('success',false,'error','REGISTRATION_REQUIRED'); END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR pg_column_size(p_payload)>100000 THEN
   RETURN jsonb_build_object('success',false,'error','INVALID_PAYLOAD');
 END IF;
 actor:=(ctx->'user'->>'id')::uuid; homes:=ctx->'user'->'households';
 IF p_area='household' AND p_operation='list' THEN RETURN jsonb_build_object('success',true,'data',homes); END IF;
 home:=NULLIF(p_payload->>'household_id','')::uuid;
 IF home IS NULL AND jsonb_array_length(homes)=1 THEN home:=(homes->0->>'id')::uuid; END IF;
 IF home IS NULL THEN RETURN jsonb_build_object('success',false,'error','SELECT_HOUSEHOLD'); END IF;
 PERFORM set_config('family_mcp.actor',actor::text,true);
 IF NOT family_mcp_private.is_member(home) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 payload:=p_payload||jsonb_build_object('household_id',home);
 IF NOT payload ? 'request_id' AND NULLIF(p_request_key,'') IS NOT NULL THEN
   payload:=payload||jsonb_build_object('request_id',md5(actor::text||':'||p_area||':'||p_operation||':'||p_request_key)::uuid);
 END IF;
 SELECT * INTO STRICT selected FROM budget.thousehold WHERE id=home;

 CASE p_area
 WHEN 'household' THEN
   CASE p_operation
   WHEN 'get' THEN
     SELECT jsonb_build_object('id',h.id,'name',h.name,'currency',h.currency,'members',(
       SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',u.full_name,'member_type',m.member_type,'role',m.role) ORDER BY m.created_at),'[]')
       FROM budget.thousehold_member m JOIN budget.tuser u ON u.id=m.user_id
       WHERE m.household_id=h.id AND m.status='active' AND m.deleted_at IS NULL)) INTO result FROM budget.thousehold h WHERE h.id=home;
   WHEN 'update' THEN
     IF NOT family_mcp_private.is_member(home,true) THEN RAISE EXCEPTION 'Administrator required'; END IF;
     IF payload ? 'name' AND (NULLIF(trim(payload->>'name'),'') IS NULL OR length(payload->>'name')>100) THEN RAISE EXCEPTION 'Invalid household name'; END IF;
     IF payload ? 'currency' AND coalesce(payload->>'currency','')!~'^[A-Z]{3}$' THEN RAISE EXCEPTION 'Invalid currency'; END IF;
     UPDATE budget.thousehold SET name=CASE WHEN payload ? 'name' THEN trim(payload->>'name') ELSE name END,
       currency=CASE WHEN payload ? 'currency' THEN payload->>'currency' ELSE currency END,updated_at=now(),updated_by=actor WHERE id=home;
     result:=jsonb_build_object('id',home);
   WHEN 'add_member' THEN fn:='family_mcp_private.f_add_household_member(uuid,text,text)'::regprocedure;
   WHEN 'update_member' THEN
     IF NOT family_mcp_private.is_member(home,true) THEN RAISE EXCEPTION 'Administrator required'; END IF;
     member_kind:=payload->>'member_type';
     IF member_kind IS NULL OR member_kind NOT IN ('dad','mom','son','other') THEN RAISE EXCEPTION 'Invalid member type'; END IF;
     UPDATE budget.thousehold_member SET member_type=member_kind,updated_at=now(),updated_by=actor
     WHERE id=(payload->>'member_id')::uuid AND household_id=home AND status='active' AND deleted_at IS NULL RETURNING id INTO member;
     IF member IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
     result:=jsonb_build_object('member_id',member);
   ELSE RAISE EXCEPTION 'Unknown household operation'; END CASE;
 WHEN 'income' THEN
   CASE p_operation
   WHEN 'list' THEN SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.created_at),'[]') INTO result FROM budget.tincome_source i WHERE household_id=home AND status='active' AND deleted_at IS NULL;
   WHEN 'save' THEN
     IF NOT family_mcp_private.is_member(home,true) THEN RAISE EXCEPTION 'Administrator required'; END IF;
     amount:=(payload->>'estimated_amount')::numeric; member:=NULLIF(payload->>'household_member_id','')::uuid;
     IF amount IS NULL OR amount<0 OR amount IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) OR NULLIF(trim(payload->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Invalid income estimate'; END IF;
     IF member IS NOT NULL AND NOT EXISTS(SELECT 1 FROM budget.thousehold_member WHERE id=member AND household_id=home AND status='active' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Member not found'; END IF;
     target:=NULLIF(payload->>'id','')::uuid;
     IF target IS NULL THEN
       INSERT INTO budget.tincome_source(household_id,household_member_id,name,estimated_amount,currency,frequency,created_by)
       VALUES(home,member,trim(payload->>'name'),amount,selected.currency,coalesce(payload->>'frequency','monthly'),actor) RETURNING * INTO source;
     ELSE
       UPDATE budget.tincome_source SET household_member_id=member,name=trim(payload->>'name'),estimated_amount=amount,
       currency=selected.currency,frequency=coalesce(payload->>'frequency','monthly'),updated_at=now(),updated_by=actor
       WHERE id=target AND household_id=home AND status='active' AND deleted_at IS NULL RETURNING * INTO source;
       IF NOT FOUND THEN RAISE EXCEPTION 'Income source not found'; END IF;
     END IF;
     result:=to_jsonb(source);
   WHEN 'delete' THEN
     IF NOT family_mcp_private.is_member(home,true) THEN RAISE EXCEPTION 'Administrator required'; END IF;
     UPDATE budget.tincome_source SET status='inactive',deleted_at=now(),deleted_by=actor WHERE id=(payload->>'id')::uuid AND household_id=home AND status='active' AND deleted_at IS NULL RETURNING id INTO target;
     IF target IS NULL THEN RAISE EXCEPTION 'Income source not found'; END IF;
     result:=jsonb_build_object('id',target);
   ELSE RAISE EXCEPTION 'Unknown income operation'; END CASE;
 WHEN 'transactions' THEN
   IF p_operation='categories' THEN
     SELECT jsonb_build_object('income',jsonb_build_array(jsonb_build_object('category_key','income_general','name','Income')),
       'expense',coalesce(jsonb_agg(jsonb_build_object('category_key',b.category_key,'name',b.name) ORDER BY b.name),'[]'))
     INTO result FROM budget.tbudget_type b WHERE b.household_id=home AND b.status='active' AND b.deleted_at IS NULL;
   ELSIF p_operation='list' THEN
     result:=budget.f_messaging_tool_lab(p_channel_type,p_channel_code,'get_recent_transactions',payload||jsonb_build_object('household_name',selected.name));
   ELSIF p_operation='register' THEN
     member:=NULLIF(payload->>'member_id','')::uuid;
     IF member IS NOT NULL THEN
       SELECT a.code INTO aux_code FROM budget.thousehold_member m JOIN budget.tauxiliar a ON a.id=m.auxiliar_id
       WHERE m.id=member AND m.household_id=home AND m.status='active' AND m.deleted_at IS NULL;
       IF aux_code IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
       payload:=payload||jsonb_build_object('auxiliar_code',aux_code);
     END IF;
     result:=budget.f_messaging_tool_lab(p_channel_type,p_channel_code,'register_transaction',payload||jsonb_build_object('household_name',selected.name));
   ELSE RAISE EXCEPTION 'Unknown transaction operation'; END IF;
 WHEN 'assets' THEN
   CASE p_operation
   WHEN 'types' THEN SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY sort_order),'[]') INTO result FROM budget.tasset_type t;
   WHEN 'list' THEN fn:='family_mcp_private.f_investment_overview(uuid)'::regprocedure;
   WHEN 'register_initial' THEN fn:='family_mcp_private.f_register_household_asset(uuid,text,text,numeric,numeric,text,uuid,text,text,text,timestamptz,text,text,timestamptz,text,date,jsonb)'::regprocedure;
   WHEN 'move' THEN fn:='family_mcp_private.f_move_investment(uuid,uuid,jsonb,jsonb,numeric,numeric,numeric,numeric,text)'::regprocedure;
   ELSE RAISE EXCEPTION 'Unknown asset operation'; END CASE;
 WHEN 'vaults' THEN
   CASE p_operation
   WHEN 'list' THEN fn:='family_mcp_private.f_saving_vaults(uuid)'::regprocedure;
   WHEN 'create' THEN fn:='family_mcp_private.f_create_saving_vault(uuid,uuid,text,text,numeric)'::regprocedure;
   WHEN 'transfer' THEN fn:='family_mcp_private.f_transfer_saving_vault(uuid,uuid,jsonb,jsonb,numeric,numeric,numeric,text,timestamptz)'::regprocedure;
   ELSE RAISE EXCEPTION 'Unknown vault operation'; END CASE;
 WHEN 'reports' THEN
   CASE p_operation
   WHEN 'wealth' THEN fn:='family_mcp_private.f_household_wealth_report(uuid)'::regprocedure;
   WHEN 'available' THEN fn:='family_mcp_private.f_investment_overview(uuid)'::regprocedure;
   WHEN 'monthly_savings' THEN fn:='family_mcp_private.f_monthly_pyramid_dashboard(uuid,text)'::regprocedure;
   WHEN 'savings_history' THEN fn:='family_mcp_private.f_closed_month_savings_report(uuid,text)'::regprocedure;
   WHEN 'member_expenses' THEN fn:='family_mcp_private.f_member_expenses_report(uuid,text)'::regprocedure;
   ELSE RAISE EXCEPTION 'Unknown report operation'; END CASE;
 WHEN 'health' THEN
   IF p_operation='preferences' THEN
     IF payload->>'key' IS DISTINCT FROM 'health_opt_in' THEN RAISE EXCEPTION 'Only the health preference is exposed'; END IF;
     fn:='family_mcp_private.f_set_household_preference(uuid,text,jsonb)'::regprocedure;
   ELSE
     IF selected.preferences->>'health_opt_in' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Health is not enabled for this household'; END IF;
     CASE p_operation
     WHEN 'catalog' THEN SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY kind,sort_order),'[]') INTO result FROM budget.thealth_option o;
     WHEN 'get' THEN fn:='family_mcp_private.f_get_family_health_context(uuid)'::regprocedure;
     WHEN 'update_profile' THEN
       IF NOT EXISTS(SELECT 1 FROM budget.thousehold_member WHERE id=(payload->>'member_id')::uuid AND household_id=home AND status='active' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Member not found'; END IF;
       fn:='family_mcp_private.f_upsert_member_health_profile(uuid,jsonb)'::regprocedure;
     WHEN 'get_meal_plan' THEN fn:='family_mcp_private.f_get_meal_plan(uuid,date)'::regprocedure;
     WHEN 'save_meal_plan' THEN fn:='family_mcp_private.f_save_meal_plan(uuid,date,jsonb,numeric,text,text,text)'::regprocedure;
     ELSE RAISE EXCEPTION 'Unknown health operation'; END CASE;
   END IF;
 ELSE RAISE EXCEPTION 'Unknown MCP area'; END CASE;

 IF fn IS NOT NULL THEN result:=family_mcp_private.invoke(fn,payload); END IF;
 PERFORM set_config('family_mcp.actor',coalesce(previous_actor,''),true);
 IF jsonb_typeof(result)='object' AND result->>'success'='false' THEN RETURN result; END IF;
 RETURN jsonb_build_object('success',true,'data',result);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('success',false,'error',SQLSTATE,'message',SQLERRM);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA family_mcp_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION budget.f_family_mcp(text,text,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION budget.f_family_mcp(text,text,text,text,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
