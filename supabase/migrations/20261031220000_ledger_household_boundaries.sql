-- Journal isolation also requires preventing clients from granting themselves
-- membership in another household or changing its accounts/auxiliars.
DROP POLICY authenticated_full_access_thousehold_member ON budget.thousehold_member;
CREATE POLICY members_read ON budget.thousehold_member FOR SELECT TO authenticated USING(budget.f_is_household_member(household_id));
CREATE POLICY members_manage ON budget.thousehold_member FOR ALL TO authenticated
 USING(budget.f_is_household_member(household_id,true)) WITH CHECK(budget.f_is_household_member(household_id,true));
DROP POLICY authenticated_full_access_thousehold ON budget.thousehold;
CREATE POLICY households_read ON budget.thousehold FOR SELECT TO authenticated USING(budget.f_is_household_member(id));
CREATE POLICY households_update ON budget.thousehold FOR UPDATE TO authenticated
 USING(budget.f_is_household_member(id,true)) WITH CHECK(budget.f_is_household_member(id,true));
DROP POLICY authenticated_full_access_taccount ON budget.taccount;
CREATE POLICY accounts_read ON budget.taccount FOR SELECT TO authenticated USING(household_id IS NULL OR budget.f_is_household_member(household_id));
CREATE POLICY accounts_manage ON budget.taccount FOR ALL TO authenticated
 USING(budget.f_is_household_member(household_id,true)) WITH CHECK(budget.f_is_household_member(household_id,true));
DROP POLICY authenticated_full_access_tauxiliar ON budget.tauxiliar;
CREATE POLICY auxiliars_read ON budget.tauxiliar FOR SELECT TO authenticated USING(budget.f_is_household_member(household_id));
CREATE POLICY auxiliars_manage ON budget.tauxiliar FOR ALL TO authenticated
 USING(budget.f_is_household_member(household_id,true)) WITH CHECK(budget.f_is_household_member(household_id,true));

CREATE FUNCTION budget.f_protect_account_identity() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
BEGIN
 IF (NEW.household_id IS DISTINCT FROM OLD.household_id OR NEW.currency IS DISTINCT FROM OLD.currency)
 AND EXISTS(SELECT 1 FROM budget.ttransaction_detail WHERE account_id=OLD.id) THEN
  RAISE EXCEPTION 'A posted account cannot change household or currency';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER account_identity BEFORE UPDATE ON budget.taccount FOR EACH ROW EXECUTE FUNCTION budget.f_protect_account_identity();
CREATE FUNCTION budget.f_protect_auxiliar_identity() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
BEGIN
 IF NEW.household_id IS DISTINCT FROM OLD.household_id
 AND EXISTS(SELECT 1 FROM budget.ttransaction_detail WHERE auxiliar_id=OLD.id) THEN
  RAISE EXCEPTION 'A posted auxiliar cannot change household';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER auxiliar_identity BEFORE UPDATE ON budget.tauxiliar FOR EACH ROW EXECUTE FUNCTION budget.f_protect_auxiliar_identity();
NOTIFY pgrst,'reload schema';
