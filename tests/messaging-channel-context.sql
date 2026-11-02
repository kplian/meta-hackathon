\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); code text:='test-'||gen_random_uuid();
 home_a uuid; home_b uuid; r jsonb; tx uuid; total integer;
BEGIN
 IF has_function_privilege('anon','budget.f_messaging_context_lab(text,text)','EXECUTE')
 OR has_function_privilege('authenticated','budget.f_messaging_tool_lab(text,text,text,jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Messaging RPCs must be backend-only';
 END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT count(*) INTO total FROM budget.ttransaction;
 r:=budget.f_messaging_context_lab('telegram',code);
 IF r->>'registered' IS DISTINCT FROM 'false' OR r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Unknown identity should require registration'; END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'register_transaction','{"type":"income","amount":10,"category_key":"income_general"}');
 IF r->>'error' IS DISTINCT FROM 'REGISTRATION_REQUIRED' OR (SELECT count(*) FROM budget.ttransaction)<>total THEN
   RAISE EXCEPTION 'Unknown sender caused a write';
 END IF;
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (a,a||'@test.invalid','{"full_name":"Channel test A"}'),(b,b||'@test.invalid','{"full_name":"Channel test B"}');
 SELECT household_id INTO STRICT home_a FROM budget.thousehold_member WHERE user_id=a;
 SELECT household_id INTO STRICT home_b FROM budget.thousehold_member WHERE user_id=b;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 PERFORM public.f_select_household_pyramid(home_b,'f8505c97-2cac-4184-ad23-72c9d5086e02','{"needs":50,"debts":15,"personal":15,"saving":20}');
 PERFORM set_config('request.jwt.claim.sub','',true);
 INSERT INTO budget.tchannel(user_id,channel_type,channel_code) VALUES(a,'whatsapp',code),(b,'telegram',code);
 r:=budget.f_messaging_context_lab('whatsapp',code);
 IF r->'user'->>'id' IS DISTINCT FROM a::text THEN RAISE EXCEPTION 'WhatsApp actor mismatch'; END IF;
 r:=budget.f_messaging_context_lab('telegram',code);
 IF r->'user'->>'id' IS DISTINCT FROM b::text THEN RAISE EXCEPTION 'Telegram actor mismatch'; END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'get_user_households');
 IF r->'households'->0->>'id' IS DISTINCT FROM home_b::text THEN RAISE EXCEPTION 'Cross-channel home leak'; END IF;
 r:=budget.f_messaging_tool_lab('whatsapp',code,'register_transaction','{"type":"income","concept":"Channel A income","amount":100,"category_key":"income_general"}');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'WA income failed: %',r; END IF;
 tx:=(r->'transaction'->>'id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM budget.ttransaction WHERE id=tx AND household_id=home_a AND created_by=a AND transaction_date=now()) THEN RAISE EXCEPTION 'Wrong WA actor or date'; END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'register_transaction','{"type":"expense","concept":"Channel B expense","amount":5,"category_key":"clothing_personal_care"}');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Telegram expense failed: %',r; END IF;
 tx:=(r->'transaction'->>'id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM budget.ttransaction WHERE id=tx AND household_id=home_b AND created_by=b) THEN RAISE EXCEPTION 'Wrong Telegram actor'; END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'get_recent_transactions');
 IF jsonb_array_length(r->'transactions')<>1 OR r->'transactions'->0->>'id' IS DISTINCT FROM tx::text THEN RAISE EXCEPTION 'History leaked another channel identity: %',r; END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'get_budget_summary');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Budget summary failed: %',r; END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'get_pyramid_summary');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Pyramid summary failed: %',r; END IF;
 IF jsonb_array_length(r->'pyramid_breakdown')<>4 OR
   (SELECT sum((value->>'amount')::numeric) FROM jsonb_array_elements(r->'pyramid_breakdown'))<>5 THEN
   RAISE EXCEPTION 'Pyramid must classify each expense once: %',r;
 END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'set_budget','{"category_key":"clothing_personal_care","monthly_limit":50}');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Budget write failed: %',r; END IF;
 UPDATE budget.thousehold_member SET role='member' WHERE household_id=home_b AND user_id=b;
 r:=budget.f_messaging_tool_lab('telegram',code,'set_budget','{"category_key":"clothing_personal_care","monthly_limit":80}');
 IF r->>'error' IS DISTINCT FROM 'ADMIN_REQUIRED' THEN RAISE EXCEPTION 'Budget permissions bypassed'; END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'create_household','{"name":"Channel test new home"}');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Create home failed: %',r; END IF;
 r:=budget.f_messaging_tool_lab('telegram',code,'add_user_to_household','{}');
 IF r->>'error' IS DISTINCT FROM 'TOOL_NOT_AVAILABLE' THEN RAISE EXCEPTION 'Unavailable tool response missing'; END IF;
 UPDATE budget.tchannel SET status='inactive' WHERE user_id=b;
 r:=budget.f_messaging_context_lab('telegram',code);
 IF r->>'registered' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Inactive channel accepted'; END IF;
 UPDATE budget.tchannel SET status='active' WHERE user_id=b;
 INSERT INTO budget.tchannel(user_id,channel_type,channel_code) VALUES(a,'telegram',code);
 r:=budget.f_messaging_context_lab('telegram',code);
 IF r->>'error' IS DISTINCT FROM 'AMBIGUOUS_CHANNEL' THEN RAISE EXCEPTION 'Ambiguous sender accepted'; END IF;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 r:=budget.f_messaging_context_lab('whatsapp',code);
 IF r->>'error' IS DISTINCT FROM 'BACKEND_ONLY' THEN RAISE EXCEPTION 'Backend role guard missing'; END IF;
 RAISE NOTICE 'PASS: registration gate, typed channel isolation, both transaction channels, read scopes, budgets, permissions, household creation and inactive/ambiguous identities';
END $$;
ROLLBACK;
