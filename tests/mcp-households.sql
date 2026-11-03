\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor uuid:=gen_random_uuid(); other_actor uuid:=gen_random_uuid(); initial uuid; extra uuid; foreign_home uuid;
 c text:='991234560001'; r jsonb; ctx jsonb; n integer; tx uuid;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Household MCP QA"}'),(other_actor,other_actor||'@test.invalid','{"full_name":"Household outsider"}');
 SELECT household_id INTO STRICT initial FROM budget.thousehold_member WHERE user_id=actor;
 SELECT household_id INTO STRICT foreign_home FROM budget.thousehold_member WHERE user_id=other_actor;
 INSERT INTO budget.tchannel(user_id,channel_type,channel_code) VALUES(actor,'telegram',c);
 PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','{}',true); PERFORM set_config('request.jwt.claim.role','service_role',true);
 ctx:=budget.f_messaging_context_lab('telegram',c);
 IF jsonb_array_length(ctx#>'{user,households}')<>1 THEN RAISE EXCEPTION 'Initial context must include sole household'; END IF;
 r:=budget.f_family_mcp('telegram',c,'transactions','register','{"type":"income","concept":"Single household income","amount":100,"category_key":"income_general"}','sole-household');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Single household default failed: %',r; END IF;
 r:=budget.f_family_mcp('telegram',c,'household','create','{"name":"Trabajo QA","currency":"BOB"}','create-extra');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Creation failed: %',r; END IF;
 extra:=(r#>>'{data,household,id}')::uuid;
 IF extra=initial OR jsonb_array_length(r#>'{data,households}')<>2 THEN RAISE EXCEPTION 'Creation returned wrong scope'; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.thousehold h JOIN budget.thousehold_member m ON m.household_id=h.id JOIN budget.tauxiliar a ON a.id=m.auxiliar_id
  WHERE h.id=extra AND h.created_by=actor AND m.user_id=actor AND m.role='admin' AND a.household_id=extra AND h.setup_completed_at IS NULL) THEN
  RAISE EXCEPTION 'Creator membership/auxiliar/onboarding state wrong'; END IF;
 IF EXISTS(SELECT 1 FROM budget.taccount WHERE household_id=extra AND code NOT LIKE 'PATR-%' AND currency<>'BOB') THEN RAISE EXCEPTION 'Wrong operating currency'; END IF;
 r:=budget.f_family_mcp('telegram',c,'household','create','{"name":"Trabajo QA","currency":"BOB"}','create-extra');
 IF r->>'success' IS DISTINCT FROM 'true' OR (r#>>'{data,household,id}')::uuid<>extra OR (r#>>'{data,created}')::boolean THEN RAISE EXCEPTION 'Replay duplicated household'; END IF;
 r:=budget.f_family_mcp('telegram',c,'household','create','{"name":"Otro QA","currency":"BOB"}','create-extra');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Changed replay accepted'; END IF;
 r:=budget.f_family_mcp('telegram',c,'household','create','{"name":" trabajo qa ","currency":"BOB"}','duplicate-name');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Duplicate name accepted'; END IF;
 ctx:=budget.f_messaging_context_lab('telegram',c);
 IF jsonb_array_length(ctx#>'{user,households}')<>2 THEN RAISE EXCEPTION 'Next message context is stale'; END IF;
 SELECT count(*) INTO n FROM budget.ttransaction WHERE household_id IN (initial,extra);
 r:=budget.f_family_mcp('telegram',c,'transactions','register','{"type":"income","concept":"Ambiguous","amount":20,"category_key":"income_general"}','ambiguous');
 IF r->>'error'<>'SELECT_HOUSEHOLD' OR (SELECT count(*) FROM budget.ttransaction WHERE household_id IN (initial,extra))<>n THEN RAISE EXCEPTION 'Ambiguous transaction wrote data'; END IF;
 r:=budget.f_family_mcp('telegram',c,'transactions','register',jsonb_build_object('household_id',extra,'type','income','concept','Trabajo income','amount',200,'category_key','income_general'),'explicit');
 IF r->>'success' IS DISTINCT FROM 'true' OR NOT EXISTS(SELECT 1 FROM budget.ttransaction WHERE household_id=extra AND concept='Trabajo income' AND created_by=actor) THEN RAISE EXCEPTION 'Explicit household failed: %',r; END IF;
 r:=budget.f_family_mcp('telegram',c,'reports','available',jsonb_build_object('household_id',foreign_home));
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Cross-user access allowed'; END IF;
 r:=budget.f_family_mcp('telegram',c,'household','create',jsonb_build_object('name','Spoof','currency','BOB','user_id',other_actor),'spoof');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Model actor override allowed'; END IF;
 r:=budget.f_family_mcp('telegram',c,'household','create','{"name":"Bad currency","currency":"bolivianos"}','bad-currency');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Bad currency accepted'; END IF;
 r:=budget.f_family_mcp('telegram',c||'9','household','create','{"name":"Unknown","currency":"BOB"}','unknown');
 IF r->>'error'<>'REGISTRATION_REQUIRED' THEN RAISE EXCEPTION 'Unregistered creation allowed'; END IF;
 UPDATE budget.thousehold_member SET role='member' WHERE user_id=actor;
 r:=budget.f_family_mcp('telegram',c,'household','create','{"name":"Member only","currency":"BOB"}','member');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Non-admin creation allowed'; END IF;
 IF has_function_privilege('authenticated','family_mcp_private.create_household(uuid,jsonb,text)','EXECUTE') OR has_table_privilege('service_role','family_mcp_private.household_creation_request','SELECT') THEN RAISE EXCEPTION 'Private create exposed'; END IF;
 RAISE NOTICE 'PASS: sole/default, multiple/clarify, explicit target, creation/admin/auxiliar, replay, duplicate, isolation and permissions';
END $$;
ROLLBACK;
