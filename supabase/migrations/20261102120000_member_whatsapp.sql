-- Personal channels can only be managed by their owner.
DROP POLICY IF EXISTS authenticated_full_access_tchannel ON budget.tchannel;
CREATE POLICY channel_owner_select ON budget.tchannel FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()));
CREATE POLICY channel_owner_insert ON budget.tchannel FOR INSERT TO authenticated
 WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY channel_owner_update ON budget.tchannel FOR UPDATE TO authenticated
 USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY channel_owner_delete ON budget.tchannel FOR DELETE TO authenticated
 USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.f_set_my_whatsapp(p_phone TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor UUID := auth.uid(); phone TEXT := nullif(btrim(p_phone), '');
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF phone IS NOT NULL AND phone !~ '^\+[1-9][0-9]{7,14}$' THEN
  RAISE EXCEPTION 'Use an international phone number, for example +59171234567';
 END IF;
 -- Serialize changes for the same owner and retain inactive channels as history.
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 0));
 UPDATE budget.tchannel SET status='inactive', updated_at=now(), updated_by=actor
 WHERE user_id=actor AND channel_type='whatsapp' AND status='active' AND deleted_at IS NULL;
 IF phone IS NOT NULL THEN
  INSERT INTO budget.tchannel(user_id,channel_type,channel_code,config_json,created_by)
  VALUES(actor,'whatsapp',phone,'{"verified":false}',actor);
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.f_set_my_whatsapp(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_set_my_whatsapp(TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
