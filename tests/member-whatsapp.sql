-- Reversible integration checks for personal WhatsApp channels.
BEGIN;
INSERT INTO budget.tchannel(user_id,channel_type,channel_code)
VALUES('6f521862-f9dd-450a-ab69-79de338e2269','whatsapp','+59170000001');
SELECT set_config('request.jwt.claim.sub', id::text, true)
FROM budget.tuser WHERE email_user='valentina@demo.local';
SET LOCAL ROLE authenticated;
SELECT public.f_set_my_whatsapp('+59171234567');
DO $$ BEGIN
 IF (SELECT count(*) FROM budget.tchannel WHERE channel_type='whatsapp' AND status='active' AND deleted_at IS NULL) <> 1
 THEN RAISE EXCEPTION 'Expected one owned WhatsApp'; END IF;
 IF EXISTS(SELECT 1 FROM budget.tchannel WHERE user_id<>auth.uid())
 THEN RAISE EXCEPTION 'Other users channels are visible'; END IF;
 BEGIN
  PERFORM public.f_set_my_whatsapp('invalid');
  RAISE EXCEPTION 'Invalid number was accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Invalid number was accepted' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO budget.tchannel(user_id,channel_type,channel_code)
  VALUES('6f521862-f9dd-450a-ab69-79de338e2269','whatsapp','+59170000000');
  RAISE EXCEPTION 'Another owner was accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SELECT public.f_set_my_whatsapp('+59171234568');
DO $$ BEGIN
 IF (SELECT count(*) FROM budget.tchannel WHERE channel_type='whatsapp' AND status='active' AND deleted_at IS NULL AND channel_code='+59171234568')<>1
 THEN RAISE EXCEPTION 'Edit did not replace active number'; END IF;
END $$;
SELECT public.f_set_my_whatsapp('');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM budget.tchannel WHERE channel_type='whatsapp' AND status='active' AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'Removal left an active number'; END IF;
END $$;
ROLLBACK;
