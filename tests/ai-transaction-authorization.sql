\set ON_ERROR_STOP on
BEGIN;

-- All fixture users, households and journal entries disappear on ROLLBACK.
DO $$
DECLARE
 actor uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
 home uuid; aux uuid; foreign_aux uuid; tx uuid; result jsonb;
 channel text := 'lab-' || gen_random_uuid()::text;
 signature text := 'budget.f_register_transaction_ai_lab(text,text,text,text,numeric,text,date,character varying,json,text)';
BEGIN
 IF has_function_privilege('anon',signature,'EXECUTE')
    OR has_function_privilege('authenticated',signature,'EXECUTE')
    OR NOT has_function_privilege('service_role',signature,'EXECUTE') THEN
   RAISE EXCEPTION 'Unexpected lab RPC permissions';
 END IF;
 IF has_schema_privilege('service_role','messaging_private','USAGE') THEN
   RAISE EXCEPTION 'Backend may not bypass the adapter';
 END IF;

 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (actor,actor||'@test.invalid','{"full_name":"AI authorization fixture"}'),
 (outsider,outsider||'@test.invalid','{"full_name":"AI outsider fixture"}');
 SELECT household_id,auxiliar_id INTO STRICT home,aux
 FROM budget.thousehold_member WHERE user_id=actor;
 SELECT auxiliar_id INTO STRICT foreign_aux FROM budget.thousehold_member WHERE user_id=outsider;
 INSERT INTO budget.tchannel(user_id,channel_type,channel_code) VALUES(actor,'whatsapp',channel);

 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 result := budget.f_register_transaction_ai_lab(channel,p_type=>'income',p_amount=>100,p_category_key=>'income_general');
 IF result->>'error' IS DISTINCT FROM 'BACKEND_ONLY' THEN RAISE EXCEPTION 'Missing backend guard: %',result; END IF;

 PERFORM set_config('request.jwt.claim.role','service_role',true);
 EXECUTE 'SET LOCAL ROLE anon';
 BEGIN
   PERFORM budget.f_register_transaction_ai_lab(channel);
   RAISE EXCEPTION 'Anonymous execution was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 EXECUTE 'RESET ROLE';
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
   PERFORM budget.f_register_transaction_ai_lab(channel);
   RAISE EXCEPTION 'Authenticated client execution was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 EXECUTE 'RESET ROLE';
 result := budget.f_register_transaction_ai_lab(channel,p_channel_type=>'telegram');
 IF result->>'error' IS DISTINCT FROM 'CHANNEL_NOT_REGISTERED_OR_AMBIGUOUS' THEN RAISE EXCEPTION 'Platform isolation failed: %',result; END IF;
 result := budget.f_register_transaction_ai_lab('unknown-'||channel);
 IF result->>'error' IS DISTINCT FROM 'CHANNEL_NOT_REGISTERED_OR_AMBIGUOUS' THEN RAISE EXCEPTION 'Unknown sender accepted'; END IF;
 result := budget.f_register_transaction_ai_lab(channel,p_household_name=>'Not this household');
 IF result->>'error' IS DISTINCT FROM 'HOUSEHOLD_NOT_FOUND_OR_AMBIGUOUS' THEN RAISE EXCEPTION 'Wrong household accepted'; END IF;

 UPDATE budget.tchannel SET status='inactive' WHERE channel_code=channel;
 result := budget.f_register_transaction_ai_lab(channel);
 IF result->>'error' IS DISTINCT FROM 'CHANNEL_NOT_REGISTERED_OR_AMBIGUOUS' THEN RAISE EXCEPTION 'Inactive sender accepted'; END IF;
 UPDATE budget.tchannel SET status='active' WHERE channel_code=channel;
 UPDATE budget.thousehold_member SET status='inactive' WHERE user_id=actor AND household_id=home;
 result := budget.f_register_transaction_ai_lab(channel);
 IF result->>'error' IS DISTINCT FROM 'HOUSEHOLD_NOT_FOUND_OR_AMBIGUOUS' THEN RAISE EXCEPTION 'Inactive membership accepted'; END IF;
 UPDATE budget.thousehold_member SET status='active' WHERE user_id=actor AND household_id=home;

 -- No user JWT is present: this is precisely the failing bot scenario.
 EXECUTE 'SET LOCAL ROLE service_role';
 result := budget.f_register_transaction_ai_lab(channel,p_type=>'income',p_concept=>'Lab income',p_amount=>100,p_category_key=>'income_general',p_transaction_date=>'2000-01-01');
 EXECUTE 'RESET ROLE';
 IF result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Income failed: %',result; END IF;
 tx := (result->'transaction'->>'id')::uuid;
 IF (SELECT transaction_date FROM budget.ttransaction WHERE id=tx) IS DISTINCT FROM now() THEN
   RAISE EXCEPTION 'Model-supplied historical date was not replaced with database time';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM budget.ttransaction WHERE id=tx AND household_id=home AND created_by=actor AND type='income') THEN
   RAISE EXCEPTION 'Wrong transaction actor or household';
 END IF;
 IF (SELECT sum(debit_base-credit_base) FROM budget.ttransaction_detail WHERE transaction_id=tx)<>0 THEN
   RAISE EXCEPTION 'Unbalanced income';
 END IF;

 result := budget.f_register_transaction_ai_lab(channel,p_type=>'expense',p_concept=>'Lab expense',p_amount=>25,p_category_key=>'clothing_personal_care',p_transaction_date=>'2099-01-01');
 IF result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Expense failed: %',result; END IF;
 tx := (result->'transaction'->>'id')::uuid;
 IF (SELECT transaction_date FROM budget.ttransaction WHERE id=tx) IS DISTINCT FROM now() THEN
   RAISE EXCEPTION 'Model-supplied future date was not replaced with database time';
 END IF;
 IF (SELECT sum(debit_base-credit_base) FROM budget.ttransaction_detail WHERE transaction_id=tx)<>0 THEN
   RAISE EXCEPTION 'Unbalanced expense';
 END IF;
 IF (SELECT coalesce(sum(d.debit_base-d.credit_base),0)
     FROM budget.ttransaction_detail d JOIN budget.taccount a ON a.id=d.account_id
     WHERE a.household_id=home AND a.code='110')<>75 THEN
   RAISE EXCEPTION 'Income and expense cash balance is not 75';
 END IF;

 result := budget.f_register_transaction_ai_lab(channel,p_type=>'expense',p_items=>json_build_array(json_build_object(
   'category','clothing_personal_care','amount',5,'auxiliar_id',foreign_aux)));
 IF result->>'success' IS DISTINCT FROM 'false' OR result->>'message' IS DISTINCT FROM 'Invalid household item auxiliar' THEN
   RAISE EXCEPTION 'Foreign auxiliar accepted: %',result;
 END IF;
 result := budget.f_register_transaction_ai_lab(channel,p_amount=>-1,p_category_key=>'clothing_personal_care');
 IF result->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Negative amount accepted'; END IF;

 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Adapter changed the user JWT'; END IF;
 result := budget.f_register_transaction(p_household_id=>home,p_concept=>'App without session',p_amount=>1,p_category=>'income_general',p_type=>'income',p_user_id=>actor);
 IF result->>'message' IS DISTINCT FROM 'Unauthorized household transaction' THEN
   RAISE EXCEPTION 'App authentication was weakened: %',result;
 END IF;
 RAISE NOTICE 'PASS: backend ACL, sender/platform, active membership, income, expense, balanced entries, foreign auxiliar, amount and app session checks';
END $$;
ROLLBACK;
