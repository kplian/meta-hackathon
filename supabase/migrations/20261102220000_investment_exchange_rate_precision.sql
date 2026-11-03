-- Preserve reciprocal FX rates (e.g. 1/12) through settlement validation.
-- The previous ten-decimal rounding made 1,200 BOB validate as 99.99999996 USD.
-- Keep the strict USD tolerance: do not accept genuinely inconsistent amounts.
ALTER TABLE budget.tasset_movement
 ALTER COLUMN usd_per_household_unit TYPE numeric(48,24);

DO $migration$
DECLARE schema_name text; definition text; signature text;
BEGIN
 FOREACH schema_name IN ARRAY ARRAY['public','family_mcp_private'] LOOP
  signature:=schema_name||'.f_move_investment(uuid,uuid,jsonb,jsonb,numeric,numeric,numeric,numeric,text)';
  SELECT pg_get_functiondef(to_regprocedure(signature)) INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'Missing investment RPC: %',signature; END IF;
  IF definition !~* 'fx\s+NUMERIC\s*:=\s*round\(p_usd_per_household_unit,\s*10\)' THEN
   RAISE EXCEPTION 'Investment FX declaration changed; review migration for %',signature;
  END IF;
  definition:=regexp_replace(definition,
   'fx\s+NUMERIC\s*:=\s*round\(p_usd_per_household_unit,\s*10\)',
   'fx NUMERIC:=round(p_usd_per_household_unit,24)','i');
  EXECUTE definition;
 END LOOP;
END $migration$;

COMMENT ON COLUMN budget.tasset_movement.usd_per_household_unit IS
 'USD per one household currency unit. Preserve reciprocal FX precision; settlement stays in USD at eight decimals.';
