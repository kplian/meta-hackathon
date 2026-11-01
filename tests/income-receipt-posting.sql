\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor uuid:=gen_random_uuid(); home uuid; aux uuid; cash uuid; r jsonb;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Income receipt test"}');
 SELECT household_id,auxiliar_id INTO STRICT home,aux FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT id INTO STRICT cash FROM budget.taccount WHERE household_id=home AND code='110';
 r:=budget.f_register_transaction(p_household_id=>home,p_concept=>'Salary',p_type=>'income',p_auxiliar_id=>aux,
 p_items=>'[{"category":"clothing_personal_care","amount":10000},{"category":"income_general","amount":6000}]');
 IF r->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Receipt failed: %',r; END IF;
 IF budget.f_operating_available(home,cash)<>16000 THEN RAISE EXCEPTION 'Income did not increase cash'; END IF;
 IF (SELECT coalesce(sum(d.credit_base-d.debit_base),0) FROM budget.ttransaction_detail d JOIN budget.taccount a ON a.id=d.account_id WHERE a.household_id=home AND a.code='410')<>16000 THEN RAISE EXCEPTION 'Missing income credit'; END IF;
 r:=budget.f_register_transaction(p_household_id=>home,p_concept=>'Clothing',p_amount=>1000,p_category=>'clothing_personal_care',p_type=>'expense',p_auxiliar_id=>aux);
 IF r->>'success' IS DISTINCT FROM 'true' OR budget.f_operating_available(home,cash)<>15000 THEN RAISE EXCEPTION 'Expense changed: %',r; END IF;
END $$;
ROLLBACK;
