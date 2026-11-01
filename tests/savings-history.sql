\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE actor UUID:=gen_random_uuid(); home UUID; cash UUID; aux UUID; tx UUID; r JSONB; m JSONB; closed_at TIMESTAMPTZ; first_month TIMESTAMPTZ;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,actor||'@test.invalid','{"full_name":"Savings history test"}');
 SELECT household_id,auxiliar_id INTO STRICT home,aux FROM budget.thousehold_member WHERE user_id=actor;
 SELECT id INTO STRICT cash FROM budget.taccount WHERE household_id=home AND code='110';
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 first_month:=date_trunc('month',now() AT TIME ZONE 'America/La_Paz') AT TIME ZONE 'America/La_Paz';
 closed_at:=((date_trunc('month',now() AT TIME ZONE 'America/La_Paz')-interval '1 month') AT TIME ZONE 'America/La_Paz')+interval '1 day';
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date) VALUES(home,'income',10000,'BOB',0,closed_at) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,cash,aux,'Income',10000,0);
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date) VALUES(home,'expense',6000,'BOB',0,closed_at) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,cash,aux,'Expense',0,6000);
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date) VALUES(home,'transfer',500,'BOB',0,closed_at) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,cash,aux,'Transfer not income',500,0);
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date) VALUES(home,'income',99999,'BOB',0,first_month) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,cash,aux,'Current month excluded',99999,0);
 r:=public.f_closed_month_savings_report(home,'America/La_Paz');
 IF jsonb_array_length(r->'months')<>10 THEN RAISE EXCEPTION 'Expected 10 months'; END IF;
 m:=r->'months'->9;
 IF m->>'month'<>to_char(closed_at AT TIME ZONE 'America/La_Paz','YYYY-MM') OR (m->>'income')::numeric<>10000 OR (m->>'expenses')::numeric<>6000 OR (m->>'saving')::numeric<>4000 THEN RAISE EXCEPTION 'Wrong history: %',r; END IF;
 IF (r->'months'->0->>'income')::numeric<>0 THEN RAISE EXCEPTION 'Missing months not zero filled'; END IF;
 INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_version,transaction_date) VALUES(home,'expense',5000,'BOB',0,closed_at) RETURNING id INTO tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base) VALUES(tx,cash,aux,'Deficit',0,5000);
 r:=public.f_closed_month_savings_report(home,'America/La_Paz');
 IF (r->'months'->9->>'saving')::numeric<>-1000 THEN RAISE EXCEPTION 'Deficit hidden'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.f_closed_month_savings_report(home); RAISE EXCEPTION 'Expected authorization failure'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expected authorization failure' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: ten closed months, 10000-6000=4000, deficits, zero months, current-month exclusion, transfer exclusion and permissions';
END $$;
ROLLBACK;
