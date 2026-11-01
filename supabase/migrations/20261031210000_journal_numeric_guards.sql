-- Reject non-finite amounts and inconsistent metadata for every new entry.
CREATE OR REPLACE FUNCTION budget.f_journal_header_defaults() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=budget,public AS $$
BEGIN
 IF NEW.currency IS NULL THEN SELECT currency INTO NEW.currency FROM budget.thousehold WHERE id=NEW.household_id; END IF;
 IF NEW.ledger_version=1 AND (NEW.household_id IS NULL OR NEW.type IS NULL OR NEW.status IS DISTINCT FROM 'active'
 OR NEW.currency !~ '^[A-Z]{3}$' OR NOT(NEW.amount>0 AND NEW.amount<1e22)) THEN RAISE EXCEPTION 'Invalid journal header'; END IF;
 RETURN NEW;
END; $$;
-- Constrain line amounts without retroactively invalidating legacy records.
ALTER TABLE budget.ttransaction_detail ADD CONSTRAINT journal_line_finite_amounts
 CHECK(debit_base>=0 AND debit_base<1e22 AND credit_base>=0 AND credit_base<1e22) NOT VALID;
NOTIFY pgrst,'reload schema';
