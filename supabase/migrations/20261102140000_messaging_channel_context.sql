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
 WHERE c.channel_type=p_channel_type AND c.channel_code=trim(p_channel_code)
   AND c.status='active' AND c.deleted_at IS NULL AND u.status='active' AND u.deleted_at IS NULL;
 IF actors=0 THEN RETURN jsonb_build_object('success',true,'registered',false); END IF;
 IF actors<>1 THEN RETURN jsonb_build_object('success',false,'error','AMBIGUOUS_CHANNEL'); END IF;
 SELECT u.* INTO actor FROM budget.tchannel c JOIN budget.tuser u ON u.id=c.user_id
 WHERE c.channel_type=p_channel_type AND c.channel_code=trim(p_channel_code)
   AND c.status='active' AND c.deleted_at IS NULL AND u.status='active' AND u.deleted_at IS NULL LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'currency',h.currency,'role',m.role) ORDER BY h.name),'[]') INTO homes
 FROM budget.thousehold_member m JOIN budget.thousehold h ON h.id=m.household_id
 WHERE m.user_id=actor.id AND m.status='active' AND m.deleted_at IS NULL AND h.status='active' AND h.deleted_at IS NULL;
 RETURN jsonb_build_object('success',true,'registered',true,'user',jsonb_build_object('id',actor.id,'name',actor.full_name,'locale',actor.locale,'households',homes));
END $$;
REVOKE ALL ON FUNCTION budget.f_messaging_context_lab(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION budget.f_messaging_context_lab(text,text) TO service_role;

CREATE OR REPLACE FUNCTION budget.f_messaging_tool_lab(p_channel_type text,p_channel_code text,p_tool text,p_args jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,budget,public AS $$
DECLARE
 ctx jsonb; actor uuid; homes jsonb; selected jsonb; home uuid; home_name text; data jsonb;
 category uuid; limit_amount numeric; budget_id uuid; read_limit integer; new_currency text;
BEGIN
 ctx:=budget.f_messaging_context_lab(p_channel_type,p_channel_code);
 IF ctx->>'success' IS DISTINCT FROM 'true' THEN RETURN ctx; END IF;
 IF ctx->>'registered' IS DISTINCT FROM 'true' THEN
   RETURN jsonb_build_object('success',false,'error','REGISTRATION_REQUIRED');
 END IF;
 IF p_args IS NULL OR jsonb_typeof(p_args)<>'object' THEN RETURN jsonb_build_object('success',false,'error','INVALID_ARGUMENTS'); END IF;
 actor:=(ctx->'user'->>'id')::uuid;
 homes:=ctx->'user'->'households';
 home_name:=NULLIF(trim(p_args->>'household_name'),'');
 IF lower(home_name) IN ('null','undefined') THEN home_name:=NULL; END IF;
 SELECT coalesce(jsonb_agg(value),'[]') INTO selected FROM jsonb_array_elements(homes)
 WHERE home_name IS NULL OR lower(trim(value->>'name'))=lower(home_name);
 IF home_name IS NOT NULL AND jsonb_array_length(selected)=0 THEN
   RETURN jsonb_build_object('success',false,'error','HOUSEHOLD_NOT_FOUND');
 END IF;

 CASE p_tool
 WHEN 'get_user_households' THEN
   RETURN jsonb_build_object('success',true,'count',jsonb_array_length(homes),'households',homes);
 WHEN 'register_transaction' THEN
   RETURN budget.f_register_transaction_ai_lab(
     p_channel_code=>p_channel_code,p_channel_type=>p_channel_type,
     p_type=>coalesce(p_args->>'type','expense'),p_concept=>p_args->>'concept',
     p_category_key=>p_args->>'category_key',p_amount=>(p_args->>'amount')::numeric,
     p_household_name=>home_name,p_auxiliar_code=>p_args->>'auxiliar_code',
     p_items=>coalesce(p_args->'items','[]'::jsonb)::json);
 WHEN 'get_budget_summary' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('name',h.name,'currency',h.currency,'categories',(
     SELECT coalesce(jsonb_agg(jsonb_build_object('category_key',bt.category_key,'name',bt.name,'monthly_limit',b.monthly_limit) ORDER BY bt.name),'[]')
     FROM budget.tbudget b JOIN budget.tbudget_type bt ON bt.id=b.budget_type_id
     WHERE b.household_id=h.id AND b.status='active' AND b.deleted_at IS NULL AND bt.status='active' AND bt.deleted_at IS NULL
   )) ORDER BY h.name),'[]') INTO data FROM budget.thousehold h
   WHERE h.id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(selected));
   RETURN jsonb_build_object('success',true,'households',data);
 WHEN 'get_recent_transactions' THEN
   read_limit:=least(100,greatest(1,coalesce((p_args->>'limit')::integer,10)));
   SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.transaction_date DESC),'[]') INTO data FROM (
     SELECT t.id,h.name household,t.concept,t.type,t.amount,t.currency,t.transaction_date
     FROM budget.ttransaction t JOIN budget.thousehold h ON h.id=t.household_id
     WHERE t.household_id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(selected))
       AND t.status='active' AND t.deleted_at IS NULL
     ORDER BY t.transaction_date DESC,t.id LIMIT read_limit
   ) q;
   RETURN jsonb_build_object('success',true,'transactions',data);
 WHEN 'get_pyramid_summary' THEN
   -- Read the current four-level mapping, not the obsolete five-level RPC.
   SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.household,q.level_order),'[]') INTO data FROM (
     SELECT h.name household,h.currency,l.code,l.name,l.order_by level_order,
       coalesce((SELECT sum((d.debit_base-d.credit_base)*coalesce(t.household_fx_rate,1))
         FROM budget.ttransaction_detail d JOIN budget.ttransaction t ON t.id=d.transaction_id
         JOIN budget.taccount a ON a.id=d.account_id JOIN budget.taccount_type k ON k.id=a.account_type_id
         JOIN budget.tbudget_type bt ON bt.id=d.budget_type_id
         JOIN budget.tbudget_type hb ON hb.household_id=h.id AND hb.category_key=bt.category_key
         JOIN budget.tbudget_type_pyramid_level m ON m.budget_type_id=hb.id AND m.financial_pyramid_level_id=l.id
         WHERE t.household_id=h.id AND t.type='expense' AND k.code='expense'
           AND t.ledger_book='operating' AND t.status='active' AND t.deleted_at IS NULL
           AND d.status='active' AND d.deleted_at IS NULL AND m.status='active' AND m.deleted_at IS NULL
           AND hb.status='active' AND hb.deleted_at IS NULL),0) amount
     FROM budget.thousehold h JOIN budget.tfinancial_pyramid_level l ON l.financial_pyramid_id=h.financial_pyramid_id
     WHERE h.id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(selected)) AND l.status='active' AND l.deleted_at IS NULL
   ) q;
   RETURN jsonb_build_object('success',true,'pyramid_breakdown',data);
 WHEN 'set_budget' THEN
   IF jsonb_array_length(selected)<>1 THEN RETURN jsonb_build_object('success',false,'error','SELECT_ONE_HOUSEHOLD'); END IF;
   IF selected->0->>'role'<>'admin' THEN RETURN jsonb_build_object('success',false,'error','ADMIN_REQUIRED'); END IF;
   home:=(selected->0->>'id')::uuid;
   limit_amount:=(p_args->>'monthly_limit')::numeric;
   IF limit_amount IS NULL OR limit_amount<0 OR limit_amount IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) THEN RETURN jsonb_build_object('success',false,'error','INVALID_AMOUNT'); END IF;
   SELECT id INTO category FROM budget.tbudget_type WHERE household_id=home AND category_key=p_args->>'category_key' AND status='active' AND deleted_at IS NULL;
   IF category IS NULL THEN RETURN jsonb_build_object('success',false,'error','CATEGORY_NOT_FOUND'); END IF;
   INSERT INTO budget.tbudget(household_id,budget_type_id,monthly_limit,created_by)
   VALUES(home,category,limit_amount,actor)
   ON CONFLICT(household_id,budget_type_id) DO UPDATE SET monthly_limit=excluded.monthly_limit,updated_at=now(),updated_by=actor
   RETURNING id INTO budget_id;
   RETURN jsonb_build_object('success',true,'budget_id',budget_id,'monthly_limit',limit_amount);
 WHEN 'create_household' THEN
   new_currency:=upper(coalesce(NULLIF(trim(p_args->>'currency'),''),'BOB'));
   IF new_currency!~'^[A-Z]{3}$' THEN RETURN jsonb_build_object('success',false,'error','INVALID_CURRENCY'); END IF;
   RETURN budget.f_create_household(p_name=>(p_args->>'name')::varchar,p_currency=>new_currency::varchar,p_user_id=>actor);
 WHEN 'add_user_to_household','undo_last_action' THEN
   -- The legacy workflow pointed these tools at RPCs absent from this database.
   -- Do not fabricate another user's registration or an accounting reversal.
   RETURN jsonb_build_object('success',false,'error','TOOL_NOT_AVAILABLE','message','This operation is not available in the messaging laboratory. Use the application.');
 ELSE
   RETURN jsonb_build_object('success',false,'error','UNKNOWN_TOOL');
 END CASE;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('success',false,'error',SQLSTATE,'message',SQLERRM);
END $$;
REVOKE ALL ON FUNCTION budget.f_messaging_tool_lab(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION budget.f_messaging_tool_lab(text,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
