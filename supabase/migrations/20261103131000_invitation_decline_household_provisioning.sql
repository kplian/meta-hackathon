-- Household provisioning inserts zero budgets before it inserts the creator's
-- membership. Permit only that nested, owner-bound initialization; direct client
-- writes and all nonzero budgets still go through the normal membership/cap gate.
DO $patch$
DECLARE definition text; anchor text:=' IF auth.role()=';
BEGIN
 SELECT pg_get_functiondef('budget.f_enforce_budget_pyramid_cap()'::regprocedure) INTO definition;
 IF position(anchor in definition)=0 THEN RAISE EXCEPTION 'Unexpected budget permission guard'; END IF;
 definition:=replace(definition,anchor,$guard$
 IF TG_OP='INSERT' AND NEW.monthly_limit=0 AND pg_trigger_depth()>1
  AND EXISTS(SELECT 1 FROM budget.thousehold h WHERE h.id=NEW.household_id AND h.created_by=auth.uid() AND h.setup_completed_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM budget.thousehold_member m WHERE m.household_id=NEW.household_id) THEN
  RETURN NEW;
 END IF;
 IF auth.role()=$guard$);
 EXECUTE definition;
END $patch$;
