-- Period savings are earned income less consumption, never transfers of existing money.
CREATE OR REPLACE FUNCTION budget.f_period_income_expenses(p_home UUID,p_start TIMESTAMPTZ,p_end TIMESTAMPTZ)
RETURNS TABLE(income NUMERIC,expenses NUMERIC) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
 WITH entries AS (
 SELECT t.id,t.type,t.amount,t.ledger_version,
 COALESCE(sum(d.credit_base-d.debit_base) FILTER(WHERE k.code='income'),0) earned,
 COALESCE(sum(d.debit_base-d.credit_base) FILTER(WHERE k.code='expense'),0) consumed,
 count(d.id) FILTER(WHERE k.code IN('income','expense')) classified,
 bool_or(a.code='130') legacy_investment
 FROM budget.thousehold h JOIN budget.ttransaction t ON t.household_id=h.id
 LEFT JOIN budget.ttransaction_detail d ON d.transaction_id=t.id AND d.status='active' AND d.deleted_at IS NULL
 LEFT JOIN budget.taccount a ON a.id=d.account_id
 LEFT JOIN budget.taccount_type k ON k.id=a.account_type_id
 WHERE h.id=p_home AND t.ledger_book='operating' AND t.currency=h.currency
 AND t.type IN('income','expense') AND t.status='active' AND t.deleted_at IS NULL
 AND t.transaction_date>=p_start AND t.transaction_date<p_end AND t.transaction_date<=now()
 GROUP BY t.id
 ) SELECT COALESCE(sum(CASE WHEN ledger_version=0 AND classified=0 AND NOT COALESCE(legacy_investment,false) AND type='income' THEN amount ELSE earned END),0),
 COALESCE(sum(CASE WHEN ledger_version=0 AND classified=0 AND NOT COALESCE(legacy_investment,false) AND type='expense' THEN amount ELSE consumed END),0) FROM entries;
$$;
REVOKE ALL ON FUNCTION budget.f_period_income_expenses(UUID,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;

-- Budget allocations use onboarding estimates; received income remains a separate actual.
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
 AND transaction_date>=start_at AND transaction_date<end_at AND transaction_date<=now() AND type IN('income','expense')
 ), totals AS (
 SELECT * FROM budget.f_period_income_expenses(h.id,start_at,end_at)
 ), estimates AS (
 SELECT round(COALESCE(sum(estimated_amount * CASE frequency
 WHEN 'monthly' THEN 1 WHEN 'weekly' THEN 52::numeric/12
 WHEN 'biweekly' THEN 2 WHEN 'yearly' THEN 1::numeric/12 END)
 FILTER(WHERE currency=h.currency AND frequency<>'variable'),0),2) estimated_income,
 count(*) FILTER(WHERE currency<>h.currency OR frequency='variable') excluded_estimates
 FROM budget.tincome_source WHERE household_id=h.id AND status='active' AND deleted_at IS NULL
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
 AND d.debit_base>0 AND (tx.ledger_version=0 OR EXISTS(SELECT 1 FROM budget.taccount a JOIN budget.taccount_type k ON k.id=a.account_type_id WHERE a.id=d.account_id AND k.code='expense')) GROUP BY l.id
 ), levels AS (
 SELECT l.code,l.name,l.description,l.color,l.order_by,l.min_percentage percentage,
 round(e.estimated_income*l.min_percentage/100,2) allocated,COALESCE(m.spent,0) spent
 FROM budget.tfinancial_pyramid_level l CROSS JOIN estimates e LEFT JOIN mapped m ON m.id=l.id
 WHERE l.financial_pyramid_id=h.financial_pyramid_id AND l.status='active' AND l.deleted_at IS NULL
 )
 , movements AS (
 SELECT
 COALESCE(sum(d.credit_base) FILTER(WHERE t.vault_request_id IS NULL),0) invested,
 COALESCE(sum(d.debit_base) FILTER(WHERE t.vault_request_id IS NULL),0) returned_investments,
 COALESCE(sum(d.credit_base) FILTER(WHERE t.vault_request_id IS NOT NULL),0) reserved,
 COALESCE(sum(d.debit_base) FILTER(WHERE t.vault_request_id IS NOT NULL),0) returned_vaults
 FROM budget.ttransaction t JOIN budget.ttransaction_detail d ON d.transaction_id=t.id AND d.status='active' AND d.deleted_at IS NULL
 JOIN budget.taccount a ON a.id=d.account_id AND a.code IN('110','111','112')
 WHERE t.household_id=h.id AND t.ledger_book='operating' AND t.currency=h.currency
 AND t.status='active' AND t.deleted_at IS NULL AND t.transaction_date>=start_at AND t.transaction_date<end_at AND t.transaction_date<=now()
 AND (t.vault_request_id IS NOT NULL OR EXISTS(
 SELECT 1 FROM budget.tasset_movement m WHERE m.operating_transaction_id=t.id AND (m.source_position_id IS NOT NULL OR m.destination_position_id IS NOT NULL)
 ) OR (t.type='expense' AND EXISTS(SELECT 1 FROM budget.ttransaction_detail z JOIN budget.taccount za ON za.id=z.account_id
 WHERE z.transaction_id=t.id AND za.code='130' AND z.debit_base>0 AND z.status='active' AND z.deleted_at IS NULL)))
 ), prior AS (
 SELECT * FROM budget.f_period_income_expenses(h.id,(date_trunc('month',now() AT TIME ZONE p_timezone)-interval '1 month') AT TIME ZONE p_timezone,start_at)
 ), goal AS (SELECT COALESCE((SELECT allocated FROM levels WHERE code='saving'),0) target)
 SELECT jsonb_build_object('month',to_char(start_at AT TIME ZONE p_timezone,'YYYY-MM'),'currency',trim(h.currency),
 'income',t.income,'estimated_income',e.estimated_income,'excluded_estimates',e.excluded_estimates,'expenses',t.expenses,'unclassified',greatest(0,t.expenses-COALESCE((SELECT sum(spent) FROM levels WHERE code<>'saving'),0)),
 'savings',jsonb_build_object('generated',t.income-t.expenses,'target',g.target,
 'gap',greatest(0,g.target-(t.income-t.expenses)),'achieved',g.target>0 AND t.income-t.expenses>=g.target,
 'investment_contributions',mv.invested,'vault_contributions',mv.reserved,
 'investment_returns',mv.returned_investments,'vault_returns',mv.returned_vaults,
 'previous_month',to_char((start_at AT TIME ZONE p_timezone)-interval '1 month','YYYY-MM'),
 'previous_generated',pr.income-pr.expenses),
 'levels',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.order_by) FROM levels l),'[]'::jsonb),
 'excluded_currency_count',(SELECT count(*) FROM budget.ttransaction WHERE household_id=h.id AND ledger_book='operating' AND currency<>h.currency AND status='active' AND deleted_at IS NULL AND transaction_date>=start_at AND transaction_date<end_at AND transaction_date<=now() AND type IN('income','expense')))
 INTO result FROM totals t CROSS JOIN estimates e CROSS JOIN movements mv CROSS JOIN prior pr CROSS JOIN goal g;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_monthly_pyramid_dashboard(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_monthly_pyramid_dashboard(UUID,TEXT) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Completed months use the same definition as the current month.
CREATE OR REPLACE FUNCTION public.f_closed_month_savings_report(p_household_id UUID,p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; result JSONB;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL;
 WITH months AS (SELECT generate_series(date_trunc('month',now() AT TIME ZONE p_timezone)-interval '10 months',date_trunc('month',now() AT TIME ZONE p_timezone)-interval '1 month',interval '1 month') period)
 SELECT jsonb_build_object('currency',trim(h.currency),'months',jsonb_agg(jsonb_build_object('month',to_char(m.period,'YYYY-MM'),
 'income',f.income,'expenses',f.expenses,'saving',f.income-f.expenses) ORDER BY m.period)) INTO result
 FROM months m CROSS JOIN LATERAL budget.f_period_income_expenses(h.id,m.period AT TIME ZONE p_timezone,(m.period+interval '1 month') AT TIME ZONE p_timezone) f;
 RETURN result;
END $$;
COMMENT ON FUNCTION public.f_closed_month_savings_report(UUID,TEXT) IS 'Ten completed months: actual earned income minus consumption in household currency; same definition as current savings. Asset transfers never generate saving or expenses.';
NOTIFY pgrst,'reload schema';

-- Keep the member pie consistent: investing is not consumption.
CREATE OR REPLACE FUNCTION public.f_member_expenses_report(p_household_id UUID,p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; result JSONB; start_at TIMESTAMPTZ; end_at TIMESTAMPTZ;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL;
 start_at:=date_trunc('month',now() AT TIME ZONE p_timezone) AT TIME ZONE p_timezone;
 end_at:=(date_trunc('month',now() AT TIME ZONE p_timezone)+interval '1 month') AT TIME ZONE p_timezone;
 WITH tx AS (
 SELECT t.id,t.ledger_version,
 CASE WHEN t.ledger_version=0 AND count(d.id) FILTER(WHERE k.code='expense')=0 AND NOT COALESCE(bool_or(a.code='130'),false)
 THEN t.amount ELSE COALESCE(sum(d.debit_base-d.credit_base) FILTER(WHERE k.code='expense'),0) END amount
 FROM budget.ttransaction t
 LEFT JOIN budget.ttransaction_detail d ON d.transaction_id=t.id AND d.status='active' AND d.deleted_at IS NULL
 LEFT JOIN budget.taccount a ON a.id=d.account_id LEFT JOIN budget.taccount_type k ON k.id=a.account_type_id
 WHERE t.household_id=h.id AND t.ledger_book='operating' AND t.currency=h.currency
 AND t.type='expense' AND t.status='active' AND t.deleted_at IS NULL AND t.transaction_date>=start_at AND t.transaction_date<end_at AND t.transaction_date<=now()
 GROUP BY t.id
 ), member_lines AS (
 -- Count only debit lines; the payment credit is the same expense, not another one.
 SELECT tx.id transaction_id,m.id member_id,u.full_name, sum(d.debit_base-d.credit_base) amount
 FROM tx JOIN budget.ttransaction_detail d ON d.transaction_id=tx.id AND d.status='active' AND d.deleted_at IS NULL AND (d.debit_base<>0 OR d.credit_base<>0)
 AND tx.amount<>0
 AND (EXISTS(SELECT 1 FROM budget.taccount a JOIN budget.taccount_type k ON k.id=a.account_type_id WHERE a.id=d.account_id AND k.code='expense')
 OR (tx.ledger_version=0 AND d.debit_base>0 AND NOT EXISTS(SELECT 1 FROM budget.ttransaction_detail z JOIN budget.taccount a ON a.id=z.account_id JOIN budget.taccount_type k ON k.id=a.account_type_id WHERE z.transaction_id=tx.id AND k.code='expense' AND z.status='active' AND z.deleted_at IS NULL)))
 JOIN budget.thousehold_member m ON m.household_id=h.id AND m.auxiliar_id=d.auxiliar_id
 AND m.status='active' AND m.deleted_at IS NULL
 JOIN budget.tuser u ON u.id=m.user_id
 GROUP BY tx.id,m.id,u.full_name
 ), groups AS (
 SELECT member_id::text id,full_name name,sum(amount) amount,false is_global FROM member_lines GROUP BY member_id,full_name
 UNION ALL
 -- Unassigned lines, other auxiliars and legacy entries without details are global.
 SELECT 'global',NULL,COALESCE(sum(tx.amount-COALESCE(m.amount,0)),0),true
 FROM tx LEFT JOIN (SELECT transaction_id,sum(amount) amount FROM member_lines GROUP BY transaction_id) m ON m.transaction_id=tx.id
 ), total AS (SELECT COALESCE(sum(amount),0) amount FROM tx)
 SELECT jsonb_build_object('currency',trim(h.currency),'total',t.amount,
 'groups',COALESCE((SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object('percentage',CASE WHEN t.amount>0 THEN g.amount/t.amount*100 ELSE 0 END) ORDER BY g.is_global,g.amount DESC,g.id) FROM groups g WHERE g.amount<>0),'[]'::jsonb)) INTO result FROM total t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_member_expenses_report(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_member_expenses_report(UUID,TEXT) TO authenticated;
NOTIFY pgrst,'reload schema';
