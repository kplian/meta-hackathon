\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); phone text:='591'||lpad((floor(random()*100000000)::bigint)::text,8,'0'); r jsonb; before_count bigint;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (a,a||'@test.invalid','{"full_name":"Number format A"}'),(b,b||'@test.invalid','{"full_name":"Number format B"}');
 INSERT INTO budget.tchannel(user_id,channel_type,channel_code) VALUES(a,'whatsapp','+'||phone),(b,'telegram',phone);
 UPDATE budget.tchannel SET verified_at=now() WHERE user_id=a AND channel_type='whatsapp';
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
 r:=budget.f_messaging_context_lab('whatsapp',phone);
 IF r->'user'->>'id' IS DISTINCT FROM a::text THEN RAISE EXCEPTION 'Meta number without plus did not match stored E.164'; END IF;
 r:=budget.f_messaging_context_lab('whatsapp',' +'||phone||' ');
 IF r->'user'->>'id' IS DISTINCT FROM a::text THEN RAISE EXCEPTION 'Plus/whitespace normalization failed'; END IF;
 r:=budget.f_messaging_context_lab('telegram',phone);
 IF r->'user'->>'id' IS DISTINCT FROM b::text THEN RAISE EXCEPTION 'Cross-channel identity collision'; END IF;
 IF budget.f_messaging_channel_code('telegram','+'||phone)<>('+'||phone) THEN RAISE EXCEPTION 'Telegram identity was normalized as a phone'; END IF;
 r:=budget.f_family_mcp('whatsapp',phone,'household','list');
 IF r->>'success' IS DISTINCT FROM 'true' OR jsonb_array_length(r->'data')<>1 THEN RAISE EXCEPTION 'MCP did not resolve normalized identity'; END IF;
 r:=budget.f_family_mcp('whatsapp',phone,'transactions','register','{"type":"income","concept":"Number format probe","amount":1,"category_key":"income_general"}');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Transaction adapter still requires plus: %',r; END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.ttransaction WHERE id=(r->'data'->'transaction'->>'id')::uuid AND created_by=a) THEN RAISE EXCEPTION 'Transaction used wrong actor'; END IF;
 INSERT INTO budget.tchannel(user_id,channel_type,channel_code) VALUES(b,'whatsapp',phone);
 -- An unverified claim cannot make a verified owner ambiguous or impersonate them.
 r:=budget.f_messaging_context_lab('whatsapp',phone);
 IF r#>>'{user,id}' IS DISTINCT FROM a::text THEN RAISE EXCEPTION 'Unverified claim shadowed proven owner'; END IF;
 BEGIN
  UPDATE budget.tchannel SET verified_at=now() WHERE user_id=b AND channel_type='whatsapp';
  RAISE EXCEPTION 'Duplicate proven owner was accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 RAISE NOTICE 'WhatsApp number formats, Telegram separation, accounting actor and unique proven ownership passed';
END $$;
ROLLBACK;
