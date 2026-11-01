CREATE FUNCTION public.f_closed_month_savings_report(p_household_id UUID,p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; month_start TIMESTAMPTZ; result JSONB;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL;
 month_start:=date_trunc('month',now() AT TIME ZONE p_timezone) AT TIME ZONE p_timezone;
 WITH months AS (
 SELECT generate_series(date_trunc('month',now() AT TIME ZONE p_timezone)-interval '10 months',date_trunc('month',now() AT TIME ZONE p_timezone)-interval '1 month',interval '1 month') AS period
 ), flows AS (
 SELECT date_trunc('month',t.transaction_date AT TIME ZONE p_timezone) AS period,
 COALESCE(sum(d.debit_base-d.credit_base) FILTER(WHERE t.type='income'),0) income,
 COALESCE(sum(d.credit_base-d.debit_base) FILTER(WHERE t.type='expense'),0) expenses
 FROM budget.ttransaction t JOIN budget.ttransaction_detail d ON d.transaction_id=t.id
 JOIN budget.taccount a ON a.id=d.account_id
 WHERE t.household_id=h.id AND t.ledger_book='operating' AND t.currency=h.currency
 AND t.type IN ('income','expense') AND t.status='active' AND t.deleted_at IS NULL
 AND d.status='active' AND d.deleted_at IS NULL AND a.code='110'
 AND (a.household_id=h.id OR (a.household_id IS NULL AND a.business_type_id=h.business_type_id))
 AND t.transaction_date>=((date_trunc('month',now() AT TIME ZONE p_timezone)-interval '10 months') AT TIME ZONE p_timezone)
 AND t.transaction_date<month_start GROUP BY 1
 )
 SELECT jsonb_build_object('currency',trim(h.currency),'months',jsonb_agg(jsonb_build_object('month',to_char(m.period,'YYYY-MM'),
 'income',COALESCE(f.income,0),'expenses',COALESCE(f.expenses,0),'saving',COALESCE(f.income,0)-COALESCE(f.expenses,0)) ORDER BY m.period))
 INTO result FROM months m LEFT JOIN flows f ON f.period=m.period;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_closed_month_savings_report(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_closed_month_savings_report(UUID,TEXT) TO authenticated;
COMMENT ON FUNCTION public.f_closed_month_savings_report(UUID,TEXT) IS 'Last 10 completed calendar months. Actual income/expense flows on operating available cash (110), in household currency; excludes transfers, estimates, openings and patrimony. Saving is period surplus, not a transfer to savings.';
NOTIFY pgrst,'reload schema';
