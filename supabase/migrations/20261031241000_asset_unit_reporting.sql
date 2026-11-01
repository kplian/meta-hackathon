DROP VIEW budget.vasset_current_value;
CREATE VIEW budget.vasset_current_value WITH (security_invoker=true) AS
 SELECT p.*,v.id AS valuation_id,v.unit_price_usd AS current_unit_price_usd,v.value_usd AS current_value_usd,
 v.valued_at AS valuation_as_of,v.source AS valuation_source,v.method AS valuation_method,
 v.value_usd-p.opening_value_usd AS change_since_opening_usd,
 COALESCE((SELECT sum(b.debit_balance) FROM budget.vaccount_balance b
 WHERE b.household_id=p.household_id AND b.account_id=p.account_id AND b.auxiliar_id=p.auxiliar_id AND b.currency='USD'),0) AS carrying_value_usd
 FROM budget.tasset_position p JOIN LATERAL (
 SELECT * FROM budget.tasset_valuation v WHERE v.position_id=p.id ORDER BY valued_at DESC,recorded_at DESC,id DESC LIMIT 1
 ) v ON true WHERE p.status='active' AND p.deleted_at IS NULL;
GRANT SELECT ON budget.vasset_current_value TO authenticated,service_role;
COMMENT ON VIEW budget.vasset_current_value IS 'Latest dated observation, immutable opening and journal carrying value. Change since opening is not a realized return and may not be historical gain.';


NOTIFY pgrst,'reload schema';
