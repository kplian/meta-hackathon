\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); home UUID; aux UUID; aux2 UUID; general UUID; acct UUID; tx UUID; member2 UUID; r JSONB;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Member expense test"}');
 SELECT household_id,auxiliar_id INTO STRICT home,aux FROM budget.thousehold_member WHERE user_id=actor;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 member2:=public.f_add_household_member(home,'Second member','other');
 SELECT auxiliar_id INTO STRICT aux2 FROM budget.thousehold_member WHERE id=member2;
 SELECT auxiliar_id INTO general FROM budget.thousehold WHERE id=home;
 SELECT id INTO acct FROM budget.taccount WHERE household_id=home AND code='110';
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version) VALUES(home,'expense',1100,'BOB',0) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES
 (tx,acct,aux,'First member',600,0),(tx,acct,aux2,'Second member',200,0),(tx,acct,general,'Family expense',300,0),(tx,acct,aux,'Payment side must not duplicate',0,1100);
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version) VALUES(home,'expense',100,'BOB',0);
 -- Current-month income and previous-month expenses must not affect this report.
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version) VALUES(home,'income',90000,'BOB',0);
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date) VALUES(home,'expense',90000,'BOB',0,date_trunc('month',now() AT TIME ZONE 'America/La_Paz') AT TIME ZONE 'America/La_Paz'-interval '1 second');
 r:=public.f_member_expenses_report(home,'America/La_Paz');
 IF (r->>'total')::numeric<>1200 OR jsonb_array_length(r->'groups')<>3 THEN RAISE EXCEPTION 'Wrong totals: %',r; END IF;
 IF (SELECT (value->>'amount')::numeric FROM jsonb_array_elements(r->'groups') WHERE value->>'id'='global')<>400 THEN RAISE EXCEPTION 'General expenses not grouped'; END IF;
 IF (SELECT (value->>'amount')::numeric FROM jsonb_array_elements(r->'groups') WHERE value->>'id'=member2::text)<>200 THEN RAISE EXCEPTION 'Member auxiliary not resolved'; END IF;
 IF (SELECT sum((value->>'amount')::numeric) FROM jsonb_array_elements(r->'groups'))<>1200 THEN RAISE EXCEPTION 'Double counted journal'; END IF;
 IF abs((SELECT sum((value->>'percentage')::numeric) FROM jsonb_array_elements(r->'groups'))-100)>0.000001 THEN RAISE EXCEPTION 'Wrong percentages'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.f_member_expenses_report(home); RAISE EXCEPTION 'Expected authorization failure'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected authorization failure' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: two members + family global, split expense, legacy/unassigned, no credit duplication, month and access boundaries';
END $$;
ROLLBACK;
