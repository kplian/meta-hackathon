-- Shared USD prices contain public instrument data only; private holdings stay in positions.
CREATE TABLE budget.tasset_quote (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 instrument_kind TEXT NOT NULL CHECK(instrument_kind IN ('stock','etf','crypto','fiat')),
 symbol TEXT NOT NULL CHECK(length(symbol) BETWEEN 1 AND 50),
 exchange TEXT NOT NULL DEFAULT '' CHECK(length(exchange)<=100),
 currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 unit_price_usd NUMERIC(30,10), quoted_at TIMESTAMPTZ, source TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(instrument_kind,symbol,exchange),
 CHECK((unit_price_usd IS NULL AND quoted_at IS NULL AND source IS NULL) OR
 (unit_price_usd IS NOT NULL AND source IS NOT NULL AND unit_price_usd>0 AND unit_price_usd<1e18 AND quoted_at IS NOT NULL AND source IN ('twelve_data','identity')))
);
ALTER TABLE budget.tasset_quote ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON budget.tasset_quote FROM anon,authenticated;
GRANT SELECT ON budget.tasset_quote TO authenticated;
GRANT ALL ON budget.tasset_quote TO service_role;
CREATE POLICY quotes_read ON budget.tasset_quote FOR SELECT TO authenticated USING(true);
ALTER TABLE budget.tasset_position ADD COLUMN instrument_quote_id UUID REFERENCES budget.tasset_quote(id);

CREATE FUNCTION budget.f_link_asset_quote() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE kind TEXT; sym TEXT; venue TEXT;
BEGIN
 kind:=CASE WHEN NEW.unit_kind='fiat' THEN 'fiat' ELSE NEW.asset_type_code END;
 IF kind NOT IN ('stock','etf','crypto','fiat') OR (kind<>'fiat' AND NULLIF(trim(NEW.symbol),'') IS NULL) THEN RETURN NEW; END IF;
 sym:=CASE WHEN kind='fiat' THEN upper(trim(NEW.unit_code))||'/USD' ELSE upper(trim(NEW.symbol)) END;
 venue:=CASE WHEN kind IN ('fiat','crypto') THEN '' ELSE upper(trim(COALESCE(NEW.exchange,''))) END;
 INSERT INTO budget.tasset_quote(instrument_kind,symbol,exchange,unit_price_usd,quoted_at,source)
 VALUES(kind,sym,venue,CASE WHEN sym='USD/USD' AND kind='fiat' THEN 1 END,
 CASE WHEN sym='USD/USD' AND kind='fiat' THEN now() END,CASE WHEN sym='USD/USD' AND kind='fiat' THEN 'identity' END)
 ON CONFLICT(instrument_kind,symbol,exchange) DO NOTHING;
 SELECT id INTO STRICT NEW.instrument_quote_id FROM budget.tasset_quote WHERE instrument_kind=kind AND symbol=sym AND exchange=venue;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_link_quote BEFORE INSERT ON budget.tasset_position FOR EACH ROW EXECUTE FUNCTION budget.f_link_asset_quote();
-- Migrate instrument identities, but never publish historical/manual acquisition prices as current prices.
INSERT INTO budget.tasset_quote(instrument_kind,symbol,exchange)
SELECT DISTINCT CASE WHEN unit_kind='fiat' THEN 'fiat' ELSE asset_type_code END,
 CASE WHEN unit_kind='fiat' THEN upper(trim(unit_code))||'/USD' ELSE upper(trim(symbol)) END,
 CASE WHEN unit_kind IN ('fiat','crypto') THEN '' ELSE upper(trim(COALESCE(exchange,''))) END
FROM budget.tasset_position WHERE unit_kind='fiat' OR (asset_type_code IN ('stock','etf','crypto') AND NULLIF(trim(symbol),'') IS NOT NULL)
ON CONFLICT(instrument_kind,symbol,exchange) DO NOTHING;
UPDATE budget.tasset_quote SET unit_price_usd=1,quoted_at=now(),source='identity' WHERE instrument_kind='fiat' AND symbol='USD/USD';
UPDATE budget.tasset_position p SET instrument_quote_id=q.id FROM budget.tasset_quote q
WHERE q.instrument_kind=CASE WHEN p.unit_kind='fiat' THEN 'fiat' ELSE p.asset_type_code END
AND q.symbol=CASE WHEN p.unit_kind='fiat' THEN upper(trim(p.unit_code))||'/USD' ELSE upper(trim(p.symbol)) END
AND q.exchange=CASE WHEN p.unit_kind IN ('fiat','crypto') THEN '' ELSE upper(trim(COALESCE(p.exchange,''))) END;

-- Only the backend can publish a verified provider price; clients cannot poison shared prices.
CREATE FUNCTION public.f_upsert_asset_quote(p_kind TEXT,p_symbol TEXT,p_exchange TEXT,p_price NUMERIC,p_quoted_at TIMESTAMPTZ,p_source TEXT DEFAULT 'twelve_data')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE sym TEXT:=upper(trim(p_symbol)); venue TEXT; result UUID;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('stock','etf','crypto','fiat') OR sym IS NULL OR length(sym) NOT BETWEEN 1 AND 50
 OR p_price IS NULL OR NOT(p_price>0 AND p_price<1e18) OR p_quoted_at IS NULL OR p_quoted_at>now()+interval '5 minutes'
 OR p_source IS NULL OR p_source NOT IN ('twelve_data','identity') OR length(COALESCE(p_exchange,''))>100
 OR (p_source='identity' AND NOT(p_kind='fiat' AND sym='USD/USD' AND p_price=1))
 OR (p_kind='fiat' AND sym !~ '^[A-Z]{3}/USD$') THEN RAISE EXCEPTION 'Invalid verified USD quote'; END IF;
 venue:=CASE WHEN p_kind IN ('fiat','crypto') THEN '' ELSE upper(trim(COALESCE(p_exchange,''))) END;
 INSERT INTO budget.tasset_quote(instrument_kind,symbol,exchange,unit_price_usd,quoted_at,source)
 VALUES(p_kind,sym,venue,p_price,p_quoted_at,p_source)
 ON CONFLICT(instrument_kind,symbol,exchange) DO UPDATE
 SET unit_price_usd=EXCLUDED.unit_price_usd,quoted_at=EXCLUDED.quoted_at,source=EXCLUDED.source,updated_at=now()
 WHERE budget.tasset_quote.quoted_at IS NULL OR EXCLUDED.quoted_at>budget.tasset_quote.quoted_at;
 SELECT id INTO STRICT result FROM budget.tasset_quote WHERE instrument_kind=p_kind AND symbol=sym AND exchange=venue;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_upsert_asset_quote(TEXT,TEXT,TEXT,NUMERIC,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f_upsert_asset_quote(TEXT,TEXT,TEXT,NUMERIC,TIMESTAMPTZ,TEXT) TO service_role;
REVOKE ALL ON FUNCTION budget.f_link_asset_quote() FROM PUBLIC,anon,authenticated;

ALTER TABLE budget.ttransaction_detail
 ADD COLUMN asset_position_id UUID REFERENCES budget.tasset_position(id),
 ADD COLUMN asset_quantity_delta NUMERIC(30,12),
 ADD CONSTRAINT asset_units_pair CHECK((asset_position_id IS NULL AND asset_quantity_delta IS NULL) OR
 (asset_position_id IS NOT NULL AND asset_quantity_delta IS NOT NULL AND asset_quantity_delta > -1e18 AND asset_quantity_delta < 1e18));
CREATE INDEX transaction_detail_position ON budget.ttransaction_detail(asset_position_id) WHERE asset_position_id IS NOT NULL;
-- Historical immutable entries are enriched once; their monetary amounts are unchanged.
ALTER TABLE budget.ttransaction_detail DISABLE TRIGGER patrimony_lines_immutable;
UPDATE budget.ttransaction_detail d SET asset_position_id=p.id,
 asset_quantity_delta=CASE WHEN t.id=p.opening_transaction_id THEN p.quantity
 WHEN t.type='reversal' AND t.reversal_of=p.opening_transaction_id THEN -p.quantity ELSE 0 END
FROM budget.tasset_position p,budget.ttransaction t
WHERE t.id=d.transaction_id AND t.household_id=p.household_id AND t.ledger_book='patrimony'
AND d.account_id=p.account_id AND d.auxiliar_id=p.auxiliar_id
AND (t.id=p.opening_transaction_id OR t.type='valuation_adjustment' OR (t.type='reversal' AND t.reversal_of=p.opening_transaction_id));
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE budget.ttransaction_detail ENABLE TRIGGER patrimony_lines_immutable;
SET CONSTRAINTS ALL DEFERRED;

CREATE FUNCTION budget.f_asset_line_units() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE p budget.tasset_position; t budget.ttransaction;
BEGIN
 SELECT * INTO STRICT t FROM budget.ttransaction WHERE id=NEW.transaction_id;
 -- Existing opening and valuation RPCs gain explicit unit semantics without changing their signature.
 IF NEW.asset_position_id IS NULL AND t.ledger_book='patrimony' AND t.type IN ('opening_balance','valuation_adjustment') THEN
  SELECT * INTO p FROM budget.tasset_position WHERE id::text=t.input_data->>'asset_position_id' AND account_id=NEW.account_id AND auxiliar_id=NEW.auxiliar_id;
  IF FOUND THEN NEW.asset_position_id:=p.id; NEW.asset_quantity_delta:=CASE WHEN t.type='opening_balance' THEN NEW.quantity ELSE 0 END; END IF;
 END IF;
 IF NEW.asset_position_id IS NOT NULL THEN
  SELECT * INTO STRICT p FROM budget.tasset_position WHERE id=NEW.asset_position_id;
  IF t.household_id IS DISTINCT FROM p.household_id OR NEW.account_id<>p.account_id OR NEW.auxiliar_id<>p.auxiliar_id
  OR t.ledger_book<>'patrimony' OR t.currency<>'USD' OR (t.type='valuation_adjustment' AND NEW.asset_quantity_delta<>0)
  THEN RAISE EXCEPTION 'Asset units must match position household, account, auxiliar and USD book'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION budget.f_asset_line_units() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER asset_line_units BEFORE INSERT OR UPDATE ON budget.ttransaction_detail FOR EACH ROW EXECUTE FUNCTION budget.f_asset_line_units();
CREATE VIEW budget.vasset_quantity_balance WITH(security_invoker=true) AS
 SELECT d.asset_position_id,sum(d.asset_quantity_delta) quantity
 FROM budget.ttransaction_detail d JOIN budget.ttransaction t ON t.id=d.transaction_id
 WHERE d.asset_position_id IS NOT NULL AND t.status='active' AND t.deleted_at IS NULL
 AND d.status='active' AND d.deleted_at IS NULL AND t.transaction_date<=now()
 GROUP BY d.asset_position_id;
GRANT SELECT ON budget.vasset_quantity_balance TO authenticated,service_role;
COMMENT ON COLUMN budget.ttransaction_detail.asset_quantity_delta IS 'Signed original units: opening/buy/reward positive, sell/withdrawal negative, monetary revaluation zero. Generic quantity keeps its existing meaning.';
CREATE OR REPLACE FUNCTION public.f_remove_household_asset(p_position_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE p budget.tasset_position; t budget.ttransaction; tx UUID;
BEGIN
 SELECT * INTO STRICT p FROM budget.tasset_position WHERE id=p_position_id FOR UPDATE;
 IF NOT budget.f_is_household_member(p.household_id,true) THEN RAISE EXCEPTION 'Only an administrator can remove assets'; END IF;
 IF p.status='inactive' THEN RETURN; END IF;
 FOR t IN SELECT * FROM budget.ttransaction original WHERE household_id=p.household_id AND ledger_book='patrimony'
 AND input_data->>'asset_position_id'=p.id::text AND type<>'reversal' AND status='active' AND deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM budget.ttransaction r WHERE r.reversal_of=original.id) ORDER BY transaction_date LOOP
  INSERT INTO budget.ttransaction(household_id,concept,type,amount,currency,ledger_book,created_by,recorded_via,reversal_of,input_data)
  VALUES(p.household_id,'Anulación de registro: '||COALESCE(p.alias,p.name),'reversal',t.amount,'USD','patrimony',auth.uid(),'asset_correction',t.id,jsonb_build_object('asset_position_id',p.id)) RETURNING id INTO tx;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,quantity,unit_price,debit_base,credit_base,created_by,asset_position_id,asset_quantity_delta)
  SELECT tx,account_id,auxiliar_id,'Reverso: '||description,-quantity,unit_price,credit_base,debit_base,auth.uid(),asset_position_id,-asset_quantity_delta
  FROM budget.ttransaction_detail WHERE transaction_id=t.id AND status='active' AND deleted_at IS NULL;
  PERFORM budget.f_check_journal(tx);
 END LOOP;
 UPDATE budget.tasset_position SET status='inactive',deleted_at=now(),deleted_by=auth.uid() WHERE id=p.id;
END; $$;


NOTIFY pgrst,'reload schema';
