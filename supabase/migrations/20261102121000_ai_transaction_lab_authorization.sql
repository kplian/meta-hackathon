-- Isolated fix for the inactive messaging laboratory. The active RPCs stay unchanged.
-- Snapshot the existing accounting rules rather than change the app authentication contract.
-- Promotion to production should consolidate the engine behind the two authenticated entry points.
CREATE SCHEMA IF NOT EXISTS messaging_private;
REVOKE ALL ON SCHEMA messaging_private FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE core text; adapter text;
BEGIN
    core := pg_get_functiondef('budget.f_register_transaction(uuid,character varying,numeric,text,character varying,timestamp with time zone,character varying,character varying,text,character varying,uuid,uuid,jsonb)'::regprocedure);
    IF position($old$    -- Actors are never taken from an untrusted supplied ID or another household.
    v_user_id := auth.uid();
    IF v_user_id IS NULL OR NOT budget.f_is_household_member(p_household_id)
       OR (p_user_id IS NOT NULL AND p_user_id<>v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized household transaction';
    END IF;

$old$ IN core)=0 THEN
        RAISE EXCEPTION 'Accounting authorization changed; review the lab migration before applying';
    END IF;
    core := replace(core,'FUNCTION budget.f_register_transaction(', 'FUNCTION messaging_private.register_transaction(');
    core := replace(core,$old$    -- Actors are never taken from an untrusted supplied ID or another household.
    v_user_id := auth.uid();
    IF v_user_id IS NULL OR NOT budget.f_is_household_member(p_household_id)
       OR (p_user_id IS NOT NULL AND p_user_id<>v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized household transaction';
    END IF;

$old$,$new$    -- Only the owner-only lab adapter can supply the resolved actor.
    v_user_id := p_user_id;
    IF v_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM budget.thousehold_member hm
        JOIN budget.tuser u ON u.id=hm.user_id
        JOIN budget.thousehold h ON h.id=hm.household_id
        WHERE hm.household_id=p_household_id AND hm.user_id=v_user_id
          AND hm.status='active' AND hm.deleted_at IS NULL
          AND u.status='active' AND u.deleted_at IS NULL
          AND h.status='active' AND h.deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Unauthorized household transaction';
    END IF;

    IF p_auxiliar_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM budget.tauxiliar WHERE id=p_auxiliar_id
          AND household_id=p_household_id AND status='active' AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Invalid household auxiliar';
    END IF;
    IF p_items IS NOT NULL AND jsonb_typeof(p_items)='array' THEN
        IF EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_items) item
            WHERE NULLIF(item->>'auxiliar_id','') IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM budget.tauxiliar a WHERE a.id=(item->>'auxiliar_id')::uuid
                  AND a.household_id=p_household_id AND a.status='active' AND a.deleted_at IS NULL
            )
        ) THEN
            RAISE EXCEPTION 'Invalid household item auxiliar';
        END IF;
    END IF;

$new$);
    core := replace(core,'SECURITY DEFINER','SECURITY DEFINER SET search_path = pg_catalog, budget, public');
    EXECUTE core;
    adapter := pg_get_functiondef('budget.f_register_transaction_ai(text,text,text,text,numeric,text,date,character varying,json)'::regprocedure);
    IF position($old$    -- 1. Validate and resolve user through channel identifier
    IF p_channel_code IS NULL OR trim(p_channel_code) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_CHANNEL_CODE',
            'message', 'Channel code is required.'
        );
    END IF;

    v_user := budget.f_validate_user(p_channel_code);

    IF NOT COALESCE((v_user->>'registered')::boolean, false) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'USER_NOT_REGISTERED',
            'message', COALESCE(v_user->>'message', 'The user channel identifier is not registered in the system.')
        );
    END IF;

    v_user_id := (v_user->>'userId')::UUID;
    v_user_name := COALESCE(v_user->>'fullName', 'User');

    -- 2. Resolve household by name or fallback to member's household
    IF p_household_name IS NOT NULL AND trim(p_household_name) <> '' THEN
        SELECT h.id, h.name INTO v_household_id, v_household_name
        FROM budget.thousehold h
        JOIN budget.thousehold_member hm ON hm.household_id = h.id
        WHERE hm.user_id = v_user_id
          AND (
              lower(trim(h.name)) = lower(trim(p_household_name))
              OR h.name ILIKE '%' || trim(p_household_name) || '%'
          )
          AND h.status = 'active'
        ORDER BY CASE WHEN lower(trim(h.name)) = lower(trim(p_household_name)) THEN 0 ELSE 1 END
        LIMIT 1;
    END IF;

    IF v_household_id IS NULL THEN
        IF (v_user->'household'->>'id') IS NOT NULL THEN
            v_household_id := (v_user->'household'->>'id')::UUID;
            v_household_name := v_user->'household'->>'name';
        ELSE
            SELECT h.id, h.name INTO v_household_id, v_household_name
            FROM budget.thousehold h
            JOIN budget.thousehold_member hm ON hm.household_id = h.id
            WHERE hm.user_id = v_user_id
              AND h.status = 'active'
            ORDER BY hm.created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_household_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'HOUSEHOLD_NOT_FOUND',
            'message', 'No active household was found for this user.'
        );
    END IF;

$old$ IN adapter)=0 THEN
        RAISE EXCEPTION 'AI adapter changed; review the lab migration before applying';
    END IF;
    adapter := replace(adapter,'FUNCTION budget.f_register_transaction_ai(', 'FUNCTION budget.f_register_transaction_ai_lab(');
    -- A temporary debug exception exists on the deployed RPC, but not in git.
    adapter := replace(adapter, 'raise exception ''aqui'';', '');
    adapter := replace(adapter,'p_items json DEFAULT NULL::json)', 'p_items json DEFAULT NULL::json, p_channel_type text DEFAULT ''whatsapp''::text)');
    adapter := replace(adapter,$old$    -- 1. Validate and resolve user through channel identifier
    IF p_channel_code IS NULL OR trim(p_channel_code) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_CHANNEL_CODE',
            'message', 'Channel code is required.'
        );
    END IF;

    v_user := budget.f_validate_user(p_channel_code);

    IF NOT COALESCE((v_user->>'registered')::boolean, false) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'USER_NOT_REGISTERED',
            'message', COALESCE(v_user->>'message', 'The user channel identifier is not registered in the system.')
        );
    END IF;

    v_user_id := (v_user->>'userId')::UUID;
    v_user_name := COALESCE(v_user->>'fullName', 'User');

    -- 2. Resolve household by name or fallback to member's household
    IF p_household_name IS NOT NULL AND trim(p_household_name) <> '' THEN
        SELECT h.id, h.name INTO v_household_id, v_household_name
        FROM budget.thousehold h
        JOIN budget.thousehold_member hm ON hm.household_id = h.id
        WHERE hm.user_id = v_user_id
          AND (
              lower(trim(h.name)) = lower(trim(p_household_name))
              OR h.name ILIKE '%' || trim(p_household_name) || '%'
          )
          AND h.status = 'active'
        ORDER BY CASE WHEN lower(trim(h.name)) = lower(trim(p_household_name)) THEN 0 ELSE 1 END
        LIMIT 1;
    END IF;

    IF v_household_id IS NULL THEN
        IF (v_user->'household'->>'id') IS NOT NULL THEN
            v_household_id := (v_user->'household'->>'id')::UUID;
            v_household_name := v_user->'household'->>'name';
        ELSE
            SELECT h.id, h.name INTO v_household_id, v_household_name
            FROM budget.thousehold h
            JOIN budget.thousehold_member hm ON hm.household_id = h.id
            WHERE hm.user_id = v_user_id
              AND h.status = 'active'
            ORDER BY hm.created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_household_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'HOUSEHOLD_NOT_FOUND',
            'message', 'No active household was found for this user.'
        );
    END IF;

$old$,$new$    -- ACL plus signed backend role: no public caller can impersonate a channel.
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RETURN jsonb_build_object('success',false,'error','BACKEND_ONLY',
            'message','Only the trusted messaging backend may use this function.');
    END IF;
    IF p_channel_type NOT IN ('whatsapp','telegram') OR p_channel_type IS NULL THEN
        RETURN jsonb_build_object('success',false,'error','INVALID_CHANNEL_TYPE');
    END IF;
    IF NULLIF(trim(p_channel_code),'') IS NULL THEN
        RETURN jsonb_build_object('success',false,'error','INVALID_CHANNEL_CODE');
    END IF;

    -- Match the platform as well as the sender ID; reject ambiguous registrations.
    IF (SELECT count(DISTINCT ch.user_id) FROM budget.tchannel ch
        JOIN budget.tuser u ON u.id=ch.user_id
        WHERE ch.channel_type=p_channel_type AND ch.channel_code=trim(p_channel_code)
          AND ch.status='active' AND ch.deleted_at IS NULL
          AND u.status='active' AND u.deleted_at IS NULL) <> 1 THEN
        RETURN jsonb_build_object('success',false,'error','CHANNEL_NOT_REGISTERED_OR_AMBIGUOUS');
    END IF;
    SELECT u.id,u.full_name INTO v_user_id,v_user_name
    FROM budget.tchannel ch JOIN budget.tuser u ON u.id=ch.user_id
    WHERE ch.channel_type=p_channel_type AND ch.channel_code=trim(p_channel_code)
      AND ch.status='active' AND ch.deleted_at IS NULL
      AND u.status='active' AND u.deleted_at IS NULL LIMIT 1;

    -- Never silently fall back to another household when a supplied name is wrong.
    IF (SELECT count(*) FROM budget.thousehold h
        JOIN budget.thousehold_member hm ON hm.household_id=h.id
        WHERE hm.user_id=v_user_id AND hm.status='active' AND hm.deleted_at IS NULL
          AND h.status='active' AND h.deleted_at IS NULL
          AND (NULLIF(trim(p_household_name),'') IS NULL
               OR lower(trim(h.name))=lower(trim(p_household_name)))) <> 1 THEN
        RETURN jsonb_build_object('success',false,'error','HOUSEHOLD_NOT_FOUND_OR_AMBIGUOUS',
            'message','Select one active household to which the sender belongs.');
    END IF;
    SELECT h.id,h.name INTO v_household_id,v_household_name
    FROM budget.thousehold h JOIN budget.thousehold_member hm ON hm.household_id=h.id
    WHERE hm.user_id=v_user_id AND hm.status='active' AND hm.deleted_at IS NULL
      AND h.status='active' AND h.deleted_at IS NULL
      AND (NULLIF(trim(p_household_name),'') IS NULL
           OR lower(trim(h.name))=lower(trim(p_household_name)));

$new$);
    adapter := replace(adapter,'budget.f_register_transaction(', 'messaging_private.register_transaction(');
    EXECUTE adapter;
END;
$migration$;

REVOKE ALL ON FUNCTION messaging_private.register_transaction(uuid,character varying,numeric,text,character varying,timestamp with time zone,character varying,character varying,text,character varying,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION budget.f_register_transaction_ai_lab(text,text,text,text,numeric,text,date,character varying,json,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION budget.f_register_transaction_ai_lab(text,text,text,text,numeric,text,date,character varying,json,text) TO service_role;
COMMENT ON FUNCTION budget.f_register_transaction_ai_lab(text,text,text,text,numeric,text,date,character varying,json,text) IS 'Laboratory only. Backend must verify the platform webhook and bind sender ID outside the LLM. No user JWT impersonation.';
NOTIFY pgrst, 'reload schema';
