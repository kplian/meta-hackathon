\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); a jsonb; b jsonb; r jsonb; msg text; phone text:='+19995550101';
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"WhatsApp ownership QA"}'),(outsider,outsider||'@test.invalid','{"full_name":"WhatsApp outsider QA"}');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 a:=public.f_begin_whatsapp_verification(phone,'pt'); msg:=a->>'message';
 IF a->>'success'<>'true' OR length(msg)<>69 OR a->>'bot_phone'<>'59144660408' THEN RAISE EXCEPTION 'Challenge response invalid'; END IF;
 IF EXISTS(SELECT 1 FROM family_mcp_private.whatsapp_link_challenge WHERE token_hash=substring(msg from 6)) THEN RAISE EXCEPTION 'Raw token stored'; END IF;
 IF (public.f_my_whatsapp_verification()->>'verified')::boolean THEN RAISE EXCEPTION 'Registration marked verified'; END IF;
 b:=public.f_begin_whatsapp_verification(phone,'es');
 IF b->>'error'<>'RATE_LIMITED' THEN RAISE EXCEPTION 'Rate limit missing'; END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 r:=budget.f_messaging_context_lab('whatsapp',substring(phone from 2));
 IF r->>'registered'<>'false' THEN RAISE EXCEPTION 'Unverified number authorized'; END IF;
 r:=budget.f_family_mcp('whatsapp',substring(phone from 2),'reports','available','{}');
 IF r->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Unverified MCP access'; END IF;
 r:=budget.f_messaging_ingress_lab('whatsapp','19995550102',msg,'814563555083416');
 IF r#>>'{verification,verified}'<>'false' THEN RAISE EXCEPTION 'Other sender linked'; END IF;
 r:=budget.f_messaging_ingress_lab('whatsapp',substring(phone from 2),msg,'wrong-account');
 IF r#>>'{verification,verified}'<>'false' THEN RAISE EXCEPTION 'Other bot linked'; END IF;
 r:=budget.f_messaging_ingress_lab('whatsapp',substring(phone from 2),'LINK invalid','814563555083416');
 IF r#>>'{verification,handled}'<>'true' OR r#>>'{verification,verified}'<>'false' THEN RAISE EXCEPTION 'Malformed code reached AI'; END IF;
 r:=budget.f_messaging_ingress_lab('whatsapp',substring(phone from 2),msg,'814563555083416');
 IF r#>>'{verification,verified}'<>'true' OR r#>>'{verification,locale}'<>'pt' THEN RAISE EXCEPTION 'Valid confirmation failed: %',r; END IF;
 IF (public.f_my_whatsapp_verification()->>'verified')<>'true' THEN RAISE EXCEPTION 'App did not see confirmation'; END IF;
 r:=budget.f_messaging_context_lab('whatsapp',substring(phone from 2));
 IF r#>>'{user,id}'<>actor::text THEN RAISE EXCEPTION 'Confirmed sender got wrong account'; END IF;
 r:=budget.f_messaging_ingress_lab('whatsapp',substring(phone from 2),msg,'814563555083416');
 IF r#>>'{verification,verified}'<>'false' THEN RAISE EXCEPTION 'Consumed code reused'; END IF;
 -- A second app account may not steal a verified number, even with a new valid challenge.
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 a:=public.f_begin_whatsapp_verification(phone,'en');
 r:=budget.f_messaging_ingress_lab('whatsapp',substring(phone from 2),a->>'message','814563555083416');
 IF r#>>'{verification,verified}'<>'false' THEN RAISE EXCEPTION 'Verified number stolen'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM public.f_set_my_whatsapp('+19995550103');
 r:=budget.f_messaging_context_lab('whatsapp',substring(phone from 2));
 IF r->>'registered'<>'false' THEN RAISE EXCEPTION 'Old number remains authorized'; END IF;
 UPDATE family_mcp_private.whatsapp_link_challenge SET created_at=now()-interval '2 minutes' WHERE user_id=actor;
 a:=public.f_begin_whatsapp_verification('+19995550103','es');
 UPDATE family_mcp_private.whatsapp_link_challenge SET expires_at=now()-interval '1 second' WHERE user_id=actor;
 r:=budget.f_messaging_ingress_lab('whatsapp','19995550103',a->>'message','814563555083416');
 IF r#>>'{verification,verified}'<>'false' THEN RAISE EXCEPTION 'Expired code linked'; END IF;
 UPDATE family_mcp_private.whatsapp_link_challenge SET created_at=now()-interval '2 minutes' WHERE user_id=actor;
 a:=public.f_begin_whatsapp_verification('+19995550103','es');
 PERFORM public.f_set_my_whatsapp('');
 r:=budget.f_messaging_ingress_lab('whatsapp','19995550103',a->>'message','814563555083416');
 IF r#>>'{verification,verified}'<>'false' THEN RAISE EXCEPTION 'Removed number linked'; END IF;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 r:=budget.f_messaging_ingress_lab('whatsapp',substring(phone from 2),msg,'814563555083416');
 IF r->>'error'<>'BACKEND_ONLY' THEN RAISE EXCEPTION 'Public backend ingress'; END IF;
 -- Save fixture ID for real-role RLS checks below.
 PERFORM set_config('qa.whatsapp_actor',actor::text,true);
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('qa.whatsapp_actor'),true);
SELECT public.f_set_my_whatsapp('+19995550104');
DO $$ BEGIN
 BEGIN
  UPDATE budget.tchannel SET verified_at=now(),config_json='{"verified":true}' WHERE user_id=auth.uid() AND channel_type='whatsapp';
  IF FOUND THEN RAISE EXCEPTION 'Client self-verified'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO budget.tchannel(user_id,channel_type,channel_code,verified_at) VALUES(auth.uid(),'whatsapp','+19995550105',now());
  RAISE EXCEPTION 'Client manufactured verified channel';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE budget.tchannel SET channel_type='telegram' WHERE user_id=auth.uid() AND channel_type='whatsapp';
  IF FOUND THEN RAISE EXCEPTION 'Client changed verification platform'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_table_privilege('authenticated','family_mcp_private.whatsapp_link_challenge','SELECT') OR has_function_privilege('authenticated','budget.f_messaging_ingress_lab(text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Private verification exposed'; END IF;
 RAISE NOTICE 'PASS: real-role RLS blocks self-verification; expiration/replay/sender/account/uniqueness/MCP gates validated';
END $$;
RESET ROLE;
ROLLBACK;
