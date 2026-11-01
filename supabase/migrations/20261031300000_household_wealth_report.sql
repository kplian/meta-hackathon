-- Valuation snapshots price the originally registered units (p.quantity).
-- Additional capital/reinvested returns are net USD debits on the position's
-- account + auxiliar. Never sum valuation snapshots or valuation journal deltas.
CREATE FUNCTION public.f_household_wealth_report(p_household_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE result JSONB;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 WITH positions AS (
 SELECT p.id,p.asset_type_code,p.name,p.alias,p.symbol,
 COALESCE(v.value_usd,p.opening_value_usd) reference_value_usd,
 COALESCE(v.valued_at,p.created_at) valuation_as_of,
 COALESCE(flows.amount,0) capital_changes_usd,
 COALESCE(v.value_usd,p.opening_value_usd)+COALESCE(flows.amount,0) value_usd
 FROM budget.tasset_position p
 LEFT JOIN LATERAL (SELECT value_usd,valued_at FROM budget.tasset_valuation
 WHERE position_id=p.id AND valued_at<=now() ORDER BY valued_at DESC,recorded_at DESC,id DESC LIMIT 1) v ON true
 LEFT JOIN LATERAL (
 SELECT sum(d.debit_base-d.credit_base) amount
 FROM budget.ttransaction_detail d JOIN budget.ttransaction t ON t.id=d.transaction_id
 WHERE d.account_id=p.account_id AND d.auxiliar_id=p.auxiliar_id
 AND t.household_id=p.household_id AND t.ledger_book='patrimony' AND t.currency='USD'
 AND t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL
 AND t.transaction_date<=now() AND t.type NOT IN ('opening_balance','valuation_adjustment')
 -- A reversal of an opening/valuation is not an additional capital movement.
 AND NOT EXISTS(SELECT 1 FROM budget.ttransaction original WHERE original.id=t.reversal_of AND original.type IN ('opening_balance','valuation_adjustment'))
 ) flows ON true
 WHERE p.household_id=p_household_id AND p.status='active' AND p.deleted_at IS NULL
 ), totals AS (SELECT COALESCE(sum(value_usd),0) total FROM positions)
 SELECT jsonb_build_object('currency','USD','total',t.total,
 'assets',COALESCE((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('percentage',CASE WHEN t.total>0 THEN p.value_usd/t.total*100 ELSE 0 END) ORDER BY p.value_usd DESC,p.id) FROM positions p),'[]'::jsonb)) INTO result FROM totals t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_household_wealth_report(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_household_wealth_report(UUID) TO authenticated;
NOTIFY pgrst,'reload schema';
