-- Read-only monthly summary. Header incomes are counted once; expense debits
-- are counted once (never both sides of a double-entry posting).
CREATE OR REPLACE FUNCTION public.f_monthly_pyramid_dashboard(p_household_id UUID,p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; start_at TIMESTAMPTZ; end_at TIMESTAMPTZ; result JSONB;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL;
 start_at:=date_trunc('month',now() AT TIME ZONE p_timezone) AT TIME ZONE p_timezone;
 end_at:=(date_trunc('month',now() AT TIME ZONE p_timezone)+interval '1 month') AT TIME ZONE p_timezone;
 WITH tx AS (
 SELECT * FROM budget.ttransaction WHERE household_id=h.id AND ledger_book='operating'
 AND currency=h.currency AND status='active' AND deleted_at IS NULL
 AND transaction_date>=start_at AND transaction_date<end_at AND type IN('income','expense')
 ), totals AS (
 SELECT COALESCE(sum(amount) FILTER(WHERE type='income'),0) income,
 COALESCE(sum(amount) FILTER(WHERE type='expense'),0) expenses FROM tx
 ), mapped AS (
 SELECT l.id,COALESCE(sum(d.debit_base-d.credit_base),0) spent
 FROM budget.tfinancial_pyramid_level l
 JOIN budget.tbudget_type_pyramid_level m ON m.financial_pyramid_level_id=l.id AND m.status='active' AND m.deleted_at IS NULL
 JOIN budget.tbudget_type b ON b.id=m.budget_type_id AND b.household_id=h.id
 -- Older operating entries used global categories. Resolve their stable key
 -- through the selected household mapping without reading another household.
 JOIN budget.ttransaction_detail d ON (d.budget_type_id=b.id OR EXISTS(
  SELECT 1 FROM budget.tbudget_type old WHERE old.id=d.budget_type_id AND old.household_id IS NULL
  AND old.category_key=b.category_key AND old.business_type_id=h.business_type_id
 )) AND d.status='active' AND d.deleted_at IS NULL
 JOIN tx ON tx.id=d.transaction_id AND tx.type='expense'
 WHERE l.financial_pyramid_id=h.financial_pyramid_id AND l.status='active' AND l.deleted_at IS NULL
 -- Both journal sides carry the category. Select the debit side only.
 AND d.debit_base>0 GROUP BY l.id
 ), levels AS (
 SELECT l.code,l.name,l.description,l.color,l.order_by,l.min_percentage percentage,
 round(t.income*l.min_percentage/100,2) allocated,COALESCE(m.spent,0) spent
 FROM budget.tfinancial_pyramid_level l CROSS JOIN totals t LEFT JOIN mapped m ON m.id=l.id
 WHERE l.financial_pyramid_id=h.financial_pyramid_id AND l.status='active' AND l.deleted_at IS NULL
 )
 SELECT jsonb_build_object('month',to_char(start_at AT TIME ZONE p_timezone,'YYYY-MM'),'currency',trim(h.currency),
 'income',t.income,'expenses',t.expenses,'unclassified',greatest(0,t.expenses-COALESCE((SELECT sum(spent) FROM levels),0)),
 'levels',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.order_by) FROM levels l),'[]'::jsonb),
 'excluded_currency_count',(SELECT count(*) FROM budget.ttransaction WHERE household_id=h.id AND ledger_book='operating' AND currency<>h.currency AND status='active' AND deleted_at IS NULL AND transaction_date>=start_at AND transaction_date<end_at AND type IN('income','expense')))
 INTO result FROM totals t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_monthly_pyramid_dashboard(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_monthly_pyramid_dashboard(UUID,TEXT) TO authenticated;
NOTIFY pgrst,'reload schema';
