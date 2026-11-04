-- Associate invitation status with the existing member row in the household UI.
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.f_household_access(uuid)'::regprocedure) INTO definition;
 IF position('''email'',i.email,''expires_at''' in definition)=0 THEN RAISE EXCEPTION 'Unexpected invitation list shape'; END IF;
 EXECUTE replace(definition,'''email'',i.email,''expires_at''','''email'',i.email,''member_id'',i.member_id,''expires_at''');
END $patch$;
NOTIFY pgrst,'reload schema';
