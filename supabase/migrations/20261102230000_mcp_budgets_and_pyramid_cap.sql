-- Monthly category budgets reserve no cash and post no transactions.
-- Their combined spending allowance cannot consume the pyramid's saving reserve.
CREATE FUNCTION budget.f_budget_capacity(p_household uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,budget,public AS $$
DECLARE h budget.thousehold; estimated numeric; total numeric; saving numeric; reserved numeric:=0; cap numeric;
 level_total numeric; levels integer; saving_levels integer; excluded integer;
BEGIN
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household AND status='active' AND deleted_at IS NULL;
 SELECT round(coalesce(sum(estimated_amount*CASE frequency WHEN 'monthly' THEN 1 WHEN 'weekly' THEN 52::numeric/12
  WHEN 'biweekly' THEN 2 WHEN 'yearly' THEN 1::numeric/12 END) FILTER(WHERE currency=h.currency AND frequency<>'variable'),0),2),
  count(*) FILTER(WHERE currency<>h.currency OR frequency='variable') INTO estimated,excluded
 FROM budget.tincome_source WHERE household_id=h.id AND status='active' AND deleted_at IS NULL;
 SELECT coalesce(sum(monthly_limit),0) INTO total FROM budget.tbudget WHERE household_id=h.id AND status='active' AND deleted_at IS NULL;
 IF estimated IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) OR total IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) THEN RAISE EXCEPTION 'Income estimates and budgets must be finite'; END IF;
 IF h.financial_pyramid_id IS NOT NULL THEN
  SELECT count(*),coalesce(sum(l.min_percentage),0),count(*) FILTER(WHERE l.code='saving'),max(l.min_percentage) FILTER(WHERE l.code='saving')
   INTO levels,level_total,saving_levels,saving FROM budget.tfinancial_pyramid p JOIN budget.tfinancial_pyramid_level l ON l.financial_pyramid_id=p.id
   WHERE p.id=h.financial_pyramid_id AND p.household_id=h.id AND p.status='active' AND p.deleted_at IS NULL AND l.status='active' AND l.deleted_at IS NULL;
  IF levels=0 OR level_total<>100 OR saving_levels<>1 OR saving<0 OR saving>100 THEN RAISE EXCEPTION 'Configure a valid pyramid with a saving percentage before setting budgets'; END IF;
  reserved:=round(estimated*saving/100,2); cap:=greatest(0,estimated-reserved);
 END IF;
 RETURN jsonb_build_object('currency',h.currency,'pyramid_defined',h.financial_pyramid_id IS NOT NULL,
  'estimated_monthly_income',estimated,'excluded_estimates',excluded,'saving_percentage',saving,'saving_reserved',reserved,
  'spending_limit',cap,'budgeted_total',total,'remaining',CASE WHEN cap IS NULL THEN NULL ELSE cap-total END,
  'over_limit',cap IS NOT NULL AND total>cap);
END $$;
REVOKE ALL ON FUNCTION budget.f_budget_capacity(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION budget.f_enforce_budget_pyramid_cap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,budget,public AS $$
DECLARE capacity jsonb; previous numeric:=0; before_total numeric; after_total numeric; cap numeric;
BEGIN
 IF NEW.household_id IS NULL THEN RETURN NEW; END IF; -- Global provisioning templates.
 IF NEW.status IS DISTINCT FROM 'active' OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF auth.role()='anon' OR (auth.role()='authenticated' AND NOT budget.f_is_household_member(NEW.household_id)) THEN
  RAISE EXCEPTION 'Household access denied';
 END IF;
 IF NEW.monthly_limit IS NULL OR NEW.monthly_limit<0 OR NEW.monthly_limit IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) THEN
  RAISE EXCEPTION 'Budget amount must be finite and nonnegative';
 END IF;
 IF TG_OP='UPDATE' THEN
  PERFORM 1 FROM budget.thousehold WHERE id IN (OLD.household_id,NEW.household_id) ORDER BY id FOR UPDATE;
 ELSE PERFORM 1 FROM budget.thousehold WHERE id=NEW.household_id FOR UPDATE; END IF;
 capacity:=budget.f_budget_capacity(NEW.household_id);
 IF NOT (capacity->>'pyramid_defined')::boolean THEN RETURN NEW; END IF;
 cap:=(capacity->>'spending_limit')::numeric; before_total:=(capacity->>'budgeted_total')::numeric;
 IF TG_OP='UPDATE' THEN
  IF OLD.household_id=NEW.household_id AND OLD.status='active' AND OLD.deleted_at IS NULL THEN previous:=OLD.monthly_limit; END IF;
 ELSE
  -- BEFORE INSERT also fires for INSERT..ON CONFLICT UPDATE. Account for the
  -- row it would replace; the UPDATE trigger validates the final row again.
  SELECT coalesce(sum(monthly_limit),0) INTO previous FROM budget.tbudget WHERE household_id=NEW.household_id
   AND budget_type_id=NEW.budget_type_id AND status='active' AND deleted_at IS NULL;
 END IF;
 after_total:=before_total-previous+NEW.monthly_limit;
 IF after_total>cap AND NOT(before_total>cap AND after_total<=before_total) THEN
  RAISE EXCEPTION 'Budget total % % exceeds pyramid spending limit % %; saving reserve is % %',
   after_total,capacity->>'currency',cap,capacity->>'currency',capacity->>'saving_reserved',capacity->>'currency'
   USING DETAIL=jsonb_build_object('error','BUDGET_PYRAMID_LIMIT','requested_total',after_total,'spending_limit',cap,'saving_reserved',capacity->'saving_reserved')::text;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION budget.f_enforce_budget_pyramid_cap() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER budget_pyramid_cap BEFORE INSERT OR UPDATE ON budget.tbudget
 FOR EACH ROW EXECUTE FUNCTION budget.f_enforce_budget_pyramid_cap();

CREATE FUNCTION family_mcp_private.budget_action(p_actor uuid,p_household uuid,p_operation text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,budget,public AS $$
DECLARE capacity jsonb; category uuid; result jsonb; amount numeric;
BEGIN
 IF p_operation='categories' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('category_key',category_key,'name',name) ORDER BY name),'[]') INTO result
   FROM budget.tbudget_type WHERE household_id=p_household AND status='active' AND deleted_at IS NULL;
  RETURN result;
 END IF;
 IF p_operation='set' THEN
  IF NOT family_mcp_private.is_member(p_household,true) THEN RAISE EXCEPTION 'Administrator required'; END IF;
  IF jsonb_typeof(p_payload->'monthly_limit') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Specify a numeric monthly budget amount'; END IF;
  amount:=(p_payload->>'monthly_limit')::numeric;
  IF amount<0 OR amount IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) THEN RAISE EXCEPTION 'Budget amount must be finite and nonnegative'; END IF;
  SELECT id INTO category FROM budget.tbudget_type WHERE household_id=p_household AND category_key=p_payload->>'category_key'
   AND status='active' AND deleted_at IS NULL;
  IF category IS NULL THEN RAISE EXCEPTION 'Budget category not found'; END IF;
  INSERT INTO budget.tbudget(household_id,budget_type_id,monthly_limit,status,created_by)
   VALUES(p_household,category,amount,'active',p_actor)
   ON CONFLICT(household_id,budget_type_id) DO UPDATE SET monthly_limit=excluded.monthly_limit,status='active',deleted_at=NULL,deleted_by=NULL,updated_at=now(),updated_by=p_actor;
 ELSIF p_operation<>'summary' THEN RAISE EXCEPTION 'Unknown budget operation'; END IF;
 capacity:=budget.f_budget_capacity(p_household);
 SELECT coalesce(jsonb_agg(jsonb_build_object('category_key',t.category_key,'name',t.name,'monthly_limit',b.monthly_limit) ORDER BY t.name),'[]') INTO result
  FROM budget.tbudget b JOIN budget.tbudget_type t ON t.id=b.budget_type_id WHERE b.household_id=p_household AND b.status='active' AND b.deleted_at IS NULL;
 RETURN capacity||jsonb_build_object('budgets',result);
END $$;
REVOKE ALL ON FUNCTION family_mcp_private.budget_action(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $migration$
DECLARE definition text; anchor text:=E' CASE p_area\n WHEN ''household'' THEN';
BEGIN
 SELECT pg_get_functiondef('budget.f_family_mcp(text,text,text,text,jsonb,text)'::regprocedure) INTO definition;
 IF strpos(definition,anchor)=0 THEN RAISE EXCEPTION 'MCP routing changed; review budget integration'; END IF;
 EXECUTE replace(definition,anchor,E' CASE p_area\n WHEN ''budgets'' THEN result:=family_mcp_private.budget_action(actor,home,p_operation,payload);\n WHEN ''household'' THEN');
END $migration$;
NOTIFY pgrst,'reload schema';
