-- Market value uses current signed units, never the sum of historical purchase USD amounts.
CREATE OR REPLACE FUNCTION public.f_household_wealth_report(p_household_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE result JSONB;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 WITH positions AS (
 SELECT p.id,p.asset_type_code,p.name,p.alias,p.symbol,p.unit_code,
 COALESCE(units.quantity,0) current_quantity,
 COALESCE(q.unit_price_usd,v.unit_price_usd,p.reference_unit_price_usd) current_unit_price_usd,
 CASE WHEN q.unit_price_usd IS NOT NULL THEN q.quoted_at ELSE COALESCE(v.valued_at,p.price_as_of,p.created_at) END valuation_as_of,
 CASE WHEN q.unit_price_usd IS NOT NULL THEN q.source ELSE COALESCE(v.source,'opening') END valuation_source,
 CASE WHEN q.unit_price_usd IS NOT NULL THEN 'shared_quote' WHEN v.source IS NOT NULL AND v.source<>'opening' THEN 'position_valuation' ELSE 'initial_reference' END valuation_basis,
 (p.instrument_quote_id IS NOT NULL AND q.unit_price_usd IS NULL) quote_missing,
 COALESCE(legacy.amount,0) capital_changes_usd,
 COALESCE(legacy.entries,0)>0 has_untracked_movements,
 COALESCE(units.quantity,0)*COALESCE(q.unit_price_usd,v.unit_price_usd,p.reference_unit_price_usd) reference_value_usd,
 COALESCE(units.quantity,0)*COALESCE(q.unit_price_usd,v.unit_price_usd,p.reference_unit_price_usd)+COALESCE(legacy.amount,0) value_usd
 FROM budget.tasset_position p
 LEFT JOIN budget.vasset_quantity_balance units ON units.asset_position_id=p.id
 LEFT JOIN budget.tasset_quote q ON q.id=p.instrument_quote_id AND q.quoted_at<=now()
 LEFT JOIN LATERAL (
 SELECT unit_price_usd,valued_at,source FROM budget.tasset_valuation
 WHERE position_id=p.id AND valued_at<=now()
 ORDER BY valued_at DESC,(source<>'opening') DESC,recorded_at DESC,id DESC LIMIT 1
 ) v ON true
 LEFT JOIN LATERAL (
 -- Compatibility for pre-unit-tracking capital movements: add only entries
 -- WITHOUT explicit units. Never add a purchase again after valuing its units.
 SELECT sum(d.debit_base-d.credit_base) amount,count(*) entries
 FROM budget.ttransaction_detail d JOIN budget.ttransaction t ON t.id=d.transaction_id
 WHERE d.account_id=p.account_id AND d.auxiliar_id=p.auxiliar_id AND d.asset_quantity_delta IS NULL
 AND t.household_id=p.household_id AND t.ledger_book='patrimony' AND t.currency='USD'
 AND t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL
 AND t.transaction_date<=now() AND t.type NOT IN ('opening_balance','valuation_adjustment')
 AND NOT EXISTS(SELECT 1 FROM budget.ttransaction original WHERE original.id=t.reversal_of AND original.type IN ('opening_balance','valuation_adjustment'))
 ) legacy ON true
 WHERE p.household_id=p_household_id AND p.status='active' AND p.deleted_at IS NULL
 ), totals AS (SELECT COALESCE(sum(value_usd),0) total FROM positions)
 SELECT jsonb_build_object('currency','USD','total',t.total,
 'assets',COALESCE((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('percentage',CASE WHEN t.total>0 THEN p.value_usd/t.total*100 ELSE 0 END) ORDER BY p.value_usd DESC,p.id) FROM positions p),'[]'::jsonb)) INTO result FROM totals t;
 RETURN result;
END $$;
COMMENT ON FUNCTION public.f_household_wealth_report(UUID) IS 'Current active position units x shared USD price, with dated individual/initial fallback. Legacy capital entries without units are added separately and flagged. No mutation of journal history.';
NOTIFY pgrst,'reload schema';
