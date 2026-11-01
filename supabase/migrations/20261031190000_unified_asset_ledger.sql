-- One journal storage, explicit currency books; no implicit FX conversion.
ALTER TABLE budget.ttransaction DROP CONSTRAINT ttransaction_type_check;
ALTER TABLE budget.ttransaction ALTER COLUMN type TYPE VARCHAR(30);
ALTER TABLE budget.ttransaction ADD CONSTRAINT ttransaction_type_check
 CHECK(type IN ('income','expense','opening_balance','transfer','asset_purchase','asset_sale','valuation_adjustment','reversal'));
ALTER TABLE budget.ttransaction
 ADD COLUMN currency CHAR(3),
 ADD COLUMN ledger_book VARCHAR(15) NOT NULL DEFAULT 'operating' CHECK(ledger_book IN ('operating','patrimony')),
 ADD COLUMN ledger_version SMALLINT NOT NULL DEFAULT 0,
 ADD COLUMN reversal_of UUID UNIQUE REFERENCES budget.ttransaction(id);
UPDATE budget.ttransaction t SET currency=COALESCE(NULLIF(trim(h.currency),''),'BOB')
 FROM budget.thousehold h WHERE h.id=t.household_id;
UPDATE budget.ttransaction SET currency='BOB' WHERE currency IS NULL;
ALTER TABLE budget.ttransaction ALTER COLUMN currency SET NOT NULL;
ALTER TABLE budget.ttransaction ALTER COLUMN ledger_version SET DEFAULT 1;
ALTER TABLE budget.ttransaction ADD CONSTRAINT patrimony_usd CHECK(ledger_book<>'patrimony' OR currency='USD');
COMMENT ON COLUMN budget.ttransaction.currency IS 'Currency of this balanced journal entry. Never aggregate different currencies without explicit FX conversion.';
ALTER TABLE budget.ttransaction_detail ALTER COLUMN budget_type_id DROP NOT NULL;
ALTER TABLE budget.ttransaction_detail ALTER COLUMN quantity TYPE NUMERIC(30,12),
 ALTER COLUMN unit_price TYPE NUMERIC(30,10),
 ALTER COLUMN debit_base TYPE NUMERIC(30,8), ALTER COLUMN credit_base TYPE NUMERIC(30,8);
COMMENT ON COLUMN budget.ttransaction_detail.debit_base IS 'Debit in the parent transaction currency, not an implicit household-currency conversion.';
COMMENT ON COLUMN budget.ttransaction_detail.credit_base IS 'Credit in the parent transaction currency.';
ALTER TABLE budget.tasset_position ADD COLUMN opening_transaction_id UUID UNIQUE REFERENCES budget.ttransaction(id);
COMMENT ON TABLE budget.tasset_entry IS 'Legacy opening journal, migrated to ttransaction/detail; retained read-only for provenance. Never combine with the common journal.';

CREATE FUNCTION budget.f_is_household_member(p_household UUID, p_admin BOOLEAN DEFAULT false)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
 SELECT EXISTS(SELECT 1 FROM budget.thousehold_member WHERE household_id=p_household AND user_id=auth.uid()
 AND status='active' AND deleted_at IS NULL AND (NOT p_admin OR role='admin'));
$$;
REVOKE ALL ON FUNCTION budget.f_is_household_member(UUID,BOOLEAN) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION budget.f_is_household_member(UUID,BOOLEAN) TO authenticated;
DROP POLICY authenticated_full_access_ttransaction ON budget.ttransaction;
DROP POLICY authenticated_full_access_ttransaction_detail ON budget.ttransaction_detail;
CREATE POLICY journal_read ON budget.ttransaction FOR SELECT TO authenticated USING(budget.f_is_household_member(household_id));
CREATE POLICY journal_lines_read ON budget.ttransaction_detail FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM budget.ttransaction t WHERE t.id=transaction_id AND budget.f_is_household_member(t.household_id)));
-- All posting must pass through authorized RPCs, never direct client writes.
REVOKE INSERT,UPDATE,DELETE ON budget.ttransaction,budget.ttransaction_detail FROM authenticated,anon;

CREATE FUNCTION budget.f_journal_header_defaults() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=budget,public AS $$
BEGIN
 IF NEW.currency IS NULL THEN SELECT currency INTO NEW.currency FROM budget.thousehold WHERE id=NEW.household_id; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER journal_header_defaults BEFORE INSERT ON budget.ttransaction FOR EACH ROW EXECUTE FUNCTION budget.f_journal_header_defaults();

-- Migrate existing positions exactly once, including voided legacy records.
DO $$ DECLARE p budget.tasset_position; tx UUID; BEGIN
 FOR p IN SELECT * FROM budget.tasset_position LOOP
  INSERT INTO budget.ttransaction(household_id,transaction_date,concept,type,amount,currency,ledger_book,recorded_via,created_by,status,input_data)
  VALUES(p.household_id,p.created_at,COALESCE(p.alias,p.name),'opening_balance',p.opening_value_usd,'USD','patrimony','onboarding',p.created_by,
   CASE WHEN p.status='active' AND p.deleted_at IS NULL THEN 'active' ELSE 'voided' END,jsonb_build_object('asset_position_id',p.id,'migrated_from','tasset_entry')) RETURNING id INTO tx;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,quantity,unit_price,debit_base,credit_base,created_by)
  SELECT tx,e.account_id,e.auxiliar_id,COALESCE(p.alias,p.name),CASE WHEN e.side='debit' THEN p.quantity ELSE 0 END,
   CASE WHEN e.side='debit' THEN p.reference_unit_price_usd ELSE 0 END,
   CASE WHEN e.side='debit' THEN e.amount_usd ELSE 0 END,CASE WHEN e.side='credit' THEN e.amount_usd ELSE 0 END,e.created_by
  FROM budget.tasset_entry e WHERE e.position_id=p.id;
  UPDATE budget.tasset_position SET opening_transaction_id=tx WHERE id=p.id;
 END LOOP;
END; $$;

CREATE FUNCTION budget.f_check_journal(p_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE t budget.ttransaction; n INT; deb NUMERIC; cre NUMERIC;
BEGIN
 SELECT * INTO t FROM budget.ttransaction WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR t.ledger_version=0 OR t.status<>'active' OR t.deleted_at IS NOT NULL THEN RETURN; END IF;
 SELECT count(*),sum(debit_base),sum(credit_base) INTO n,deb,cre FROM budget.ttransaction_detail
 WHERE transaction_id=p_id AND status='active' AND deleted_at IS NULL;
 IF n<2 OR deb IS DISTINCT FROM cre OR deb IS NULL OR deb<=0 THEN RAISE EXCEPTION 'Journal must contain balanced positive debit and credit lines'; END IF;
 IF EXISTS(SELECT 1 FROM budget.ttransaction_detail d
 JOIN budget.taccount a ON a.id=d.account_id JOIN budget.tauxiliar x ON x.id=d.auxiliar_id
 LEFT JOIN budget.tbudget_type b ON b.id=d.budget_type_id
 WHERE d.transaction_id=p_id AND d.status='active' AND d.deleted_at IS NULL AND (
 d.debit_base IS NULL OR d.credit_base IS NULL OR d.debit_base<0 OR d.credit_base<0
 OR d.debit_base='NaN'::numeric OR d.credit_base='NaN'::numeric
 OR (d.debit_base>0)=(d.credit_base>0)
 OR a.household_id IS DISTINCT FROM t.household_id OR x.household_id IS DISTINCT FROM t.household_id
 OR a.currency IS DISTINCT FROM t.currency OR NOT a.is_postable OR a.status<>'active' OR a.deleted_at IS NOT NULL
 OR x.status<>'active' OR x.deleted_at IS NOT NULL
 OR (a.requires_auxiliar AND a.required_auxiliar_type_id IS NOT NULL AND x.auxiliar_type_id<>a.required_auxiliar_type_id)
 OR (d.budget_type_id IS NOT NULL AND b.household_id IS NOT NULL AND b.household_id<>t.household_id)))
 THEN RAISE EXCEPTION 'Invalid journal line: side, currency, household, account or auxiliar'; END IF;
END; $$;
REVOKE ALL ON FUNCTION budget.f_check_journal(UUID) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION budget.f_check_journal_trigger() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
BEGIN
 IF TG_TABLE_NAME='ttransaction' THEN PERFORM budget.f_check_journal(COALESCE(NEW.id,OLD.id));
 ELSE
  IF TG_OP<>'INSERT' THEN PERFORM budget.f_check_journal(OLD.transaction_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM budget.f_check_journal(NEW.transaction_id); END IF;
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT OR UPDATE ON budget.ttransaction
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION budget.f_check_journal_trigger();
CREATE CONSTRAINT TRIGGER journal_lines_balanced AFTER INSERT OR UPDATE OR DELETE ON budget.ttransaction_detail
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION budget.f_check_journal_trigger();

-- Read-only journal by account and currency; never a cross-currency total.
CREATE VIEW budget.vaccount_balance WITH (security_invoker=true) AS
 SELECT t.household_id,t.ledger_book,t.currency,d.account_id,d.auxiliar_id,
 sum(d.debit_base) AS debits,sum(d.credit_base) AS credits,sum(d.debit_base-d.credit_base) AS debit_balance
 FROM budget.ttransaction t JOIN budget.ttransaction_detail d ON d.transaction_id=t.id
 WHERE t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL
 GROUP BY t.household_id,t.ledger_book,t.currency,d.account_id,d.auxiliar_id;
GRANT SELECT ON budget.vaccount_balance TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.f_register_household_asset(
 p_household_id UUID, p_asset_type_code TEXT, p_name TEXT, p_quantity NUMERIC,
 p_unit_price_usd NUMERIC, p_price_basis TEXT, p_request_id UUID,
 p_alias TEXT DEFAULT NULL, p_symbol TEXT DEFAULT NULL, p_exchange TEXT DEFAULT NULL,
 p_price_as_of TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE
 v_household budget.thousehold;
 v_existing budget.tasset_position;
 v_type budget.tasset_type;
 v_asset_type UUID; v_equity_type UUID; v_aux_type UUID;
 v_account UUID; v_equity UUID; v_aux UUID; v_position UUID;
 v_value NUMERIC(30,8);
 v_tx UUID;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM budget.thousehold_member
   WHERE household_id=p_household_id AND user_id=auth.uid() AND role='admin'
   AND status='active' AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'Only a household administrator can register assets';
 END IF;
 SELECT * INTO STRICT v_household FROM budget.thousehold WHERE id=p_household_id AND deleted_at IS NULL FOR UPDATE;
 SELECT * INTO v_existing FROM budget.tasset_position WHERE request_id=p_request_id AND household_id=p_household_id;
 IF FOUND THEN
   IF v_existing.asset_type_code IS DISTINCT FROM p_asset_type_code
      OR v_existing.name IS DISTINCT FROM trim(p_name)
      OR v_existing.alias IS DISTINCT FROM NULLIF(trim(p_alias),'')
      OR v_existing.symbol IS DISTINCT FROM NULLIF(trim(p_symbol),'')
      OR v_existing.exchange IS DISTINCT FROM NULLIF(trim(p_exchange),'')
      OR v_existing.quantity IS DISTINCT FROM round(p_quantity,12)
      OR v_existing.reference_unit_price_usd IS DISTINCT FROM round(p_unit_price_usd,10)
      OR v_existing.price_basis IS DISTINCT FROM p_price_basis THEN
     RAISE EXCEPTION 'Request ID already registered with different asset data';
   END IF;
   RETURN v_existing.id;
 END IF;
 SELECT * INTO STRICT v_type FROM budget.tasset_type WHERE code=p_asset_type_code;
 IF p_request_id IS NULL OR NULLIF(trim(p_name),'') IS NULL OR length(trim(p_name))>150
   OR length(p_alias)>100 OR length(p_symbol)>50 OR length(p_exchange)>100 THEN
   RAISE EXCEPTION 'Invalid asset identity';
 END IF;
 IF p_quantity IS NULL OR NOT(p_quantity>0 AND p_quantity<1e18)
   OR p_unit_price_usd IS NULL OR NOT(p_unit_price_usd>0 AND p_unit_price_usd<1e18) THEN
   RAISE EXCEPTION 'Quantity and USD price must be positive finite numbers';
 END IF;
 IF p_price_basis IS NULL OR p_price_basis NOT IN ('purchase_price','market_estimate','estimated_value') THEN
   RAISE EXCEPTION 'Invalid price basis';
 END IF;
 IF v_type.market_priced AND NULLIF(trim(p_symbol),'') IS NULL THEN RAISE EXCEPTION 'Select a market symbol'; END IF;
 IF p_price_basis='market_estimate' AND (NOT v_type.market_priced OR p_price_as_of IS NULL) THEN
   RAISE EXCEPTION 'A market estimate requires a quote timestamp';
 END IF;
 v_value:=round(round(p_quantity,12)*round(p_unit_price_usd,10),8);
 IF v_value<=0 THEN RAISE EXCEPTION 'Asset value is too small'; END IF;
 SELECT id INTO STRICT v_asset_type FROM budget.taccount_type WHERE code='asset';
 SELECT id INTO STRICT v_equity_type FROM budget.taccount_type WHERE code='equity';
 SELECT id INTO STRICT v_aux_type FROM budget.tauxiliar_type WHERE code='investment';
 INSERT INTO budget.taccount(household_id,account_type_id,business_type_id,code,name,currency,requires_auxiliar,required_auxiliar_type_id,created_by)
 VALUES(p_household_id,v_asset_type,v_household.business_type_id,'PATR-'||v_type.code,'Patrimonio - '||v_type.name,'USD',true,v_aux_type,auth.uid())
 ON CONFLICT(household_id,code) DO NOTHING;
 SELECT id INTO STRICT v_account FROM budget.taccount WHERE household_id=p_household_id AND code='PATR-'||v_type.code AND currency='USD';
 INSERT INTO budget.taccount(household_id,account_type_id,business_type_id,code,name,currency,created_by)
 VALUES(p_household_id,v_equity_type,v_household.business_type_id,'PATR-OPENING','Patrimonio inicial','USD',auth.uid())
 ON CONFLICT(household_id,code) DO NOTHING;
 SELECT id INTO STRICT v_equity FROM budget.taccount WHERE household_id=p_household_id AND code='PATR-OPENING' AND currency='USD';
 v_position:=gen_random_uuid();
 INSERT INTO budget.tauxiliar(household_id,auxiliar_type_id,code,name,description,created_by,status)
 VALUES(p_household_id,v_aux_type,'ASSET-'||v_position::text,COALESCE(NULLIF(trim(p_alias),''),trim(p_name)),'Activo patrimonial en USD',auth.uid(),'active')
 RETURNING id INTO v_aux;
 INSERT INTO budget.tasset_position(id,request_id,household_id,asset_type_code,name,alias,symbol,exchange,quantity,
 reference_unit_price_usd,opening_value_usd,price_basis,price_as_of,price_provider,account_id,auxiliar_id,created_by)
 VALUES(v_position,p_request_id,p_household_id,v_type.code,trim(p_name),NULLIF(trim(p_alias),''),NULLIF(trim(p_symbol),''),NULLIF(trim(p_exchange),''),
 p_quantity,p_unit_price_usd,v_value,p_price_basis,p_price_as_of,CASE WHEN p_price_basis='market_estimate' THEN 'twelve_data' ELSE NULL END,v_account,v_aux,auth.uid());
 INSERT INTO budget.ttransaction(household_id,concept,type,amount,currency,ledger_book,recorded_via,created_by,input_data)
 VALUES(p_household_id,COALESCE(NULLIF(trim(p_alias),''),trim(p_name)),'opening_balance',v_value,'USD','patrimony','onboarding',auth.uid(),jsonb_build_object('asset_position_id',v_position)) RETURNING id INTO v_tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,quantity,unit_price,debit_base,credit_base,created_by)
 VALUES(v_tx,v_account,v_aux,trim(p_name),p_quantity,p_unit_price_usd,v_value,0,auth.uid()),
       (v_tx,v_equity,v_aux,'Patrimonio inicial',0,0,0,v_value,auth.uid());
 UPDATE budget.tasset_position SET opening_transaction_id=v_tx WHERE id=v_position;
 PERFORM budget.f_check_journal(v_tx);
 RETURN v_position;
END;
$$;

-- Valuations are observations, not purchases, cash income or automatic revaluations.
CREATE TABLE budget.tasset_valuation (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 position_id UUID NOT NULL REFERENCES budget.tasset_position(id),
 household_id UUID NOT NULL REFERENCES budget.thousehold(id),
 request_id UUID NOT NULL UNIQUE,
 unit_price_usd NUMERIC(30,10) NOT NULL CHECK(unit_price_usd>=0 AND unit_price_usd<1e18),
 quantity NUMERIC(30,12) NOT NULL CHECK(quantity>0),
 value_usd NUMERIC(30,8) NOT NULL CHECK(value_usd>=0 AND value_usd<1e22),
 currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 valued_at TIMESTAMPTZ NOT NULL,
 source VARCHAR(20) NOT NULL CHECK(source IN ('opening','manual','twelve_data')),
 method VARCHAR(30) NOT NULL CHECK(method IN ('opening','market_quote','owner_estimate','appraisal')),
 notes TEXT,
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 recorded_by UUID NOT NULL REFERENCES budget.tuser(id),
 posted_at TIMESTAMPTZ,
 posted_transaction_id UUID UNIQUE REFERENCES budget.ttransaction(id),
 UNIQUE(position_id,source,valued_at)
);
CREATE INDEX ON budget.tasset_valuation(position_id,valued_at DESC,recorded_at DESC);
ALTER TABLE budget.tasset_valuation ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON budget.tasset_valuation TO authenticated;
GRANT ALL ON budget.tasset_valuation TO service_role;
CREATE POLICY asset_valuation_read ON budget.tasset_valuation FOR SELECT TO authenticated
 USING(budget.f_is_household_member(household_id));
CREATE FUNCTION budget.f_asset_opening_valuation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
BEGIN
 INSERT INTO budget.tasset_valuation(position_id,household_id,request_id,unit_price_usd,quantity,value_usd,valued_at,source,method,recorded_by)
 VALUES(NEW.id,NEW.household_id,NEW.request_id,NEW.reference_unit_price_usd,NEW.quantity,NEW.opening_value_usd,COALESCE(NEW.price_as_of,NEW.created_at),'opening','opening',NEW.created_by);
 RETURN NEW;
END; $$;
INSERT INTO budget.tasset_valuation(position_id,household_id,request_id,unit_price_usd,quantity,value_usd,valued_at,source,method,recorded_by)
 SELECT id,household_id,request_id,reference_unit_price_usd,quantity,opening_value_usd,COALESCE(price_as_of,created_at),'opening','opening',created_by FROM budget.tasset_position;
CREATE TRIGGER asset_opening_valuation AFTER INSERT ON budget.tasset_position FOR EACH ROW EXECUTE FUNCTION budget.f_asset_opening_valuation();

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

CREATE FUNCTION budget.f_record_asset_valuation(p_position_id UUID,p_unit_price_usd NUMERIC,p_valued_at TIMESTAMPTZ,
 p_request_id UUID,p_source TEXT,p_method TEXT,p_notes TEXT,p_actor_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE p budget.tasset_position; existing budget.tasset_valuation; result UUID;
BEGIN
 SELECT * INTO STRICT p FROM budget.tasset_position WHERE id=p_position_id FOR UPDATE;
 IF p.status<>'active' OR p.deleted_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM budget.thousehold_member
 WHERE household_id=p.household_id AND user_id=p_actor_id AND role='admin' AND status='active' AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'Only an active household administrator can value an active asset'; END IF;
 IF p_unit_price_usd IS NULL OR NOT(p_unit_price_usd>=0 AND p_unit_price_usd<1e18)
 OR p_valued_at IS NULL OR p_valued_at>now()+interval '5 minutes' OR p_request_id IS NULL
 OR p_source NOT IN ('manual','twelve_data') OR p_method NOT IN ('owner_estimate','appraisal','market_quote')
 OR (p_source='twelve_data')<>(p_method='market_quote')
 OR (p_source='manual' AND NULLIF(trim(p_notes),'') IS NULL) THEN RAISE EXCEPTION 'Invalid valuation, date, source or missing explanation'; END IF;
 IF p_source='twelve_data' AND NOT EXISTS(SELECT 1 FROM budget.tasset_type WHERE code=p.asset_type_code AND market_priced) THEN RAISE EXCEPTION 'Asset has no market quote'; END IF;
 SELECT * INTO existing FROM budget.tasset_valuation WHERE request_id=p_request_id OR (position_id=p.id AND source=p_source AND valued_at=p_valued_at)
 ORDER BY (request_id=p_request_id) DESC LIMIT 1;
 IF FOUND THEN
  IF existing.position_id<>p.id OR existing.unit_price_usd<>round(p_unit_price_usd,10) OR existing.valued_at<>p_valued_at
  OR existing.source<>p_source OR existing.method<>p_method OR (p_source='manual' AND existing.notes IS DISTINCT FROM trim(p_notes))
  THEN RAISE EXCEPTION 'Valuation already recorded with different data'; END IF;
  RETURN existing.id;
 END IF;
 INSERT INTO budget.tasset_valuation(position_id,household_id,request_id,unit_price_usd,quantity,value_usd,valued_at,source,method,notes,recorded_by)
 VALUES(p.id,p.household_id,p_request_id,p_unit_price_usd,p.quantity,round(round(p_unit_price_usd,10)*p.quantity,8),p_valued_at,p_source,p_method,NULLIF(trim(p_notes),''),p_actor_id)
 RETURNING id INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION budget.f_record_asset_valuation(UUID,NUMERIC,TIMESTAMPTZ,UUID,TEXT,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.f_record_manual_asset_valuation(p_position_id UUID,p_unit_price_usd NUMERIC,p_valued_at TIMESTAMPTZ,
 p_request_id UUID,p_notes TEXT,p_method TEXT DEFAULT 'owner_estimate') RETURNS UUID
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
BEGIN
 IF auth.uid() IS NULL OR p_method IS NULL OR p_method NOT IN ('owner_estimate','appraisal') THEN RAISE EXCEPTION 'Invalid manual valuation'; END IF;
 RETURN budget.f_record_asset_valuation(p_position_id,p_unit_price_usd,p_valued_at,p_request_id,'manual',p_method,p_notes,auth.uid());
END; $$;
CREATE FUNCTION public.f_record_market_asset_valuation(p_position_id UUID,p_unit_price_usd NUMERIC,p_valued_at TIMESTAMPTZ,
 p_request_id UUID,p_actor_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
BEGIN
 RETURN budget.f_record_asset_valuation(p_position_id,p_unit_price_usd,p_valued_at,p_request_id,'twelve_data','market_quote',NULL,p_actor_id);
END; $$;
REVOKE ALL ON FUNCTION public.f_record_manual_asset_valuation(UUID,NUMERIC,TIMESTAMPTZ,UUID,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_record_manual_asset_valuation(UUID,NUMERIC,TIMESTAMPTZ,UUID,TEXT,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.f_record_market_asset_valuation(UUID,NUMERIC,TIMESTAMPTZ,UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f_record_market_asset_valuation(UUID,NUMERIC,TIMESTAMPTZ,UUID,UUID) TO service_role;

-- Optional, explicit management revaluation; never invoked by market refresh.
-- Counterpart is a USD management revaluation reserve, not cash income.
CREATE FUNCTION public.f_post_asset_valuation(p_valuation_id UUID) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE v budget.tasset_valuation; p budget.tasset_position; delta NUMERIC; carrying NUMERIC; reserve UUID; tx UUID; equity UUID;
BEGIN
 SELECT * INTO STRICT v FROM budget.tasset_valuation WHERE id=p_valuation_id;
 SELECT * INTO STRICT p FROM budget.tasset_position WHERE id=v.position_id FOR UPDATE;
 SELECT * INTO STRICT v FROM budget.tasset_valuation WHERE id=p_valuation_id FOR UPDATE;
 IF NOT budget.f_is_household_member(p.household_id,true) OR p.status<>'active' OR p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Unauthorized valuation posting'; END IF;
 IF v.posted_at IS NOT NULL THEN RETURN v.posted_transaction_id; END IF;
 IF v.source='opening' OR v.valued_at<(SELECT max(valued_at) FROM budget.tasset_valuation WHERE position_id=p.id)
 OR EXISTS(SELECT 1 FROM budget.ttransaction WHERE household_id=p.household_id AND ledger_book='patrimony'
 AND input_data->>'asset_position_id'=p.id::text AND transaction_date>v.valued_at AND status='active')
 THEN RAISE EXCEPTION 'Only a current valuation after the last posting can be posted'; END IF;
 SELECT COALESCE(sum(d.debit_base-d.credit_base),0) INTO carrying FROM budget.ttransaction_detail d
 JOIN budget.ttransaction t ON t.id=d.transaction_id WHERE d.account_id=p.account_id AND d.auxiliar_id=p.auxiliar_id
 AND t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL;
 delta:=v.value_usd-carrying;
 IF delta<>0 THEN
  SELECT id INTO STRICT equity FROM budget.taccount_type WHERE code='equity';
  INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency,created_by)
  VALUES(p.household_id,equity,'PATR-REVALUATION','Ajustes de valoración patrimonial','USD',auth.uid()) ON CONFLICT(household_id,code) DO NOTHING;
  SELECT id INTO STRICT reserve FROM budget.taccount WHERE household_id=p.household_id AND code='PATR-REVALUATION' AND currency='USD';
  INSERT INTO budget.ttransaction(household_id,transaction_date,concept,type,amount,currency,ledger_book,created_by,recorded_via,input_data)
  VALUES(p.household_id,v.valued_at,'Actualización: '||COALESCE(p.alias,p.name),'valuation_adjustment',abs(delta),'USD','patrimony',auth.uid(),'asset_valuation',
   jsonb_build_object('asset_position_id',p.id,'valuation_id',v.id,'policy','management_revaluation_reserve')) RETURNING id INTO tx;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,created_by)
  VALUES(tx,p.account_id,p.auxiliar_id,'Ajuste de valoración',greatest(delta,0),greatest(-delta,0),auth.uid()),
        (tx,reserve,p.auxiliar_id,'Contrapartida de valoración',greatest(-delta,0),greatest(delta,0),auth.uid());
  PERFORM budget.f_check_journal(tx);
 END IF;
 UPDATE budget.tasset_valuation SET posted_at=now(),posted_transaction_id=tx WHERE id=v.id;
 RETURN tx;
END; $$;
REVOKE ALL ON FUNCTION public.f_post_asset_valuation(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_post_asset_valuation(UUID) TO authenticated;

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
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,quantity,unit_price,debit_base,credit_base,created_by)
  SELECT tx,account_id,auxiliar_id,'Reverso: '||description,-quantity,unit_price,credit_base,debit_base,auth.uid()
  FROM budget.ttransaction_detail WHERE transaction_id=t.id AND status='active' AND deleted_at IS NULL;
  PERFORM budget.f_check_journal(tx);
 END LOOP;
 UPDATE budget.tasset_position SET status='inactive',deleted_at=now(),deleted_by=auth.uid() WHERE id=p.id;
END; $$;

-- Historical postings are append-only; corrections use reversing entries.
CREATE FUNCTION budget.f_protect_patrimony_journal() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=budget,public AS $$
DECLARE is_patrimony BOOLEAN;
BEGIN
 IF TG_TABLE_NAME='ttransaction' THEN is_patrimony:=OLD.ledger_book='patrimony';
 ELSE SELECT ledger_book='patrimony' INTO is_patrimony FROM budget.ttransaction WHERE id=OLD.transaction_id; END IF;
 IF is_patrimony THEN RAISE EXCEPTION 'Patrimony postings are immutable; use a reversing entry'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER patrimony_header_immutable BEFORE UPDATE OR DELETE ON budget.ttransaction FOR EACH ROW EXECUTE FUNCTION budget.f_protect_patrimony_journal();
CREATE TRIGGER patrimony_lines_immutable BEFORE UPDATE OR DELETE ON budget.ttransaction_detail FOR EACH ROW EXECUTE FUNCTION budget.f_protect_patrimony_journal();
CREATE FUNCTION budget.f_legacy_asset_journal_readonly() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Legacy asset journal is read-only; use the common journal'; END; $$;
CREATE TRIGGER legacy_asset_journal_readonly BEFORE INSERT OR UPDATE OR DELETE ON budget.tasset_entry FOR EACH ROW EXECUTE FUNCTION budget.f_legacy_asset_journal_readonly();

NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION budget.f_register_transaction(
    p_household_id UUID,
    p_concept VARCHAR,
    p_amount NUMERIC DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_type VARCHAR DEFAULT 'expense',
    p_transaction_date TIMESTAMPTZ DEFAULT now(),
    p_operation_code VARCHAR DEFAULT NULL,
    p_external_reference VARCHAR DEFAULT NULL,
    p_source_text TEXT DEFAULT NULL,
    p_recorded_via VARCHAR DEFAULT 'app',
    p_user_id UUID DEFAULT NULL,
    p_auxiliar_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_household_id UUID;
    v_auxiliar_id UUID;
    v_type VARCHAR(10);
    v_operation_code VARCHAR(50);
    v_items JSONB;
    v_item JSONB;
    v_total_amount NUMERIC := 0;
    v_sum_items NUMERIC := 0;
    v_transaction_id UUID;
    v_header_template_id UUID := NULL;
    v_input_data JSONB;

    -- Iteration variables
    v_item_idx INT := 0;
    v_cat_str TEXT;
    v_item_amount NUMERIC;
    v_item_desc VARCHAR(500);
    v_item_qty NUMERIC;
    v_item_price NUMERIC;
    v_item_code VARCHAR(30);
    v_item_unit VARCHAR(30);
    v_item_auxiliar UUID;
    v_budget_type_id UUID;
    v_budget_type_name VARCHAR(300);
    v_item_template_id UUID;
    v_resolved_template_id UUID;
    v_template_det RECORD;
    v_det_account_id UUID;
    v_debit_base NUMERIC;
    v_credit_base NUMERIC;
    v_line_desc VARCHAR(500);
    v_detail_id UUID;
    v_details_result JSONB := '[]'::jsonb;
    v_detail_count INT := 0;
    v_item_count INT := 0;
BEGIN
    -- 1. Validate household
    IF p_household_id IS NULL THEN
        RAISE EXCEPTION 'p_household_id is required';
    END IF;

    SELECT id INTO v_household_id
    FROM budget.thousehold
    WHERE id = p_household_id;

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Household with id % not found', p_household_id;
    END IF;

    -- Actors are never taken from an untrusted supplied ID or another household.
    v_user_id := auth.uid();
    IF v_user_id IS NULL OR NOT budget.f_is_household_member(p_household_id)
       OR (p_user_id IS NOT NULL AND p_user_id<>v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized household transaction';
    END IF;

    -- 3. Resolve default auxiliar
    v_auxiliar_id := p_auxiliar_id;
    IF v_auxiliar_id IS NULL AND v_user_id IS NOT NULL THEN
        SELECT hm.auxiliar_id INTO v_auxiliar_id
        FROM budget.thousehold_member hm
        WHERE hm.household_id = p_household_id
          AND hm.user_id = v_user_id
          AND hm.auxiliar_id IS NOT NULL
        LIMIT 1;
    END IF;

    IF v_auxiliar_id IS NULL THEN
        SELECT a.id INTO v_auxiliar_id
        FROM budget.tauxiliar a
        WHERE a.household_id = p_household_id
          AND a.status = 'active'
        LIMIT 1;
    END IF;

    -- 4. Validate and normalize transaction type
    v_type := lower(COALESCE(NULLIF(p_type, ''), 'expense'));
    IF v_type NOT IN ('expense', 'income') THEN
        RAISE EXCEPTION 'Invalid transaction type: %. Must be either ''expense'' or ''income''', p_type;
    END IF;

    -- 5. Normalize items list (supports both single general item and N items)
    IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
        v_items := p_items;
    ELSE
        -- Single general item flow
        IF p_category IS NULL OR trim(p_category) = '' THEN
            RAISE EXCEPTION 'p_category is required when p_items is not provided';
        END IF;

        IF p_amount IS NULL OR p_amount <= 0 THEN
            RAISE EXCEPTION 'p_amount must be greater than 0 when p_items is not provided';
        END IF;

        v_items := jsonb_build_array(
            jsonb_build_object(
                'category', p_category,
                'amount', p_amount,
                'description', p_concept,
                'quantity', 1,
                'unit_price', p_amount,
                'unit_measure_code', 'unit',
                'item_code', 'ITM-001'
            )
        );
    END IF;

    -- 6. Calculate total amount
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_amount := COALESCE((v_item->>'amount')::numeric, 0);
        IF v_item_amount <= 0 THEN
            RAISE EXCEPTION 'Each item must have an amount greater than 0';
        END IF;
        v_sum_items := v_sum_items + v_item_amount;
        v_item_count := v_item_count + 1;
    END LOOP;

    v_total_amount := COALESCE(p_amount, v_sum_items);
    IF v_total_amount IS DISTINCT FROM v_sum_items THEN
        RAISE EXCEPTION 'Header total must equal item total';
    END IF;
    IF v_total_amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be greater than 0';
    END IF;

    -- 7. Generate operation code if not provided
    v_operation_code := COALESCE(
        NULLIF(trim(p_operation_code), ''),
        'OP-' || to_char(COALESCE(p_transaction_date, now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))
    );

    -- 8. Prepare input_data payload
    v_input_data := jsonb_build_object(
        'concept', p_concept,
        'amount', v_total_amount,
        'type', v_type,
        'recorded_via', COALESCE(p_recorded_via, 'app'),
        'items', v_items
    );

    -- 9. Insert transaction header (budget.ttransaction)
    INSERT INTO budget.ttransaction (
        household_id,
        template_transaction_id,
        transaction_date,
        operation_code,
        concept,
        type,
        amount,
        external_reference,
        source_text,
        input_data,
        recorded_via,
        created_by,
        status
    ) VALUES (
        p_household_id,
        NULL, -- Will update if primary template found
        COALESCE(p_transaction_date, now()),
        v_operation_code,
        p_concept,
        v_type,
        v_total_amount,
        p_external_reference,
        p_source_text,
        v_input_data,
        COALESCE(p_recorded_via, 'app'),
        v_user_id,
        'active'
    )
    RETURNING id INTO v_transaction_id;

    -- 10. Process each item and generate detail lines (budget.ttransaction_detail)
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_idx := v_item_idx + 1;
        v_cat_str := COALESCE(v_item->>'category', v_item->>'category_id', v_item->>'budget_type_id');
        v_item_amount := (v_item->>'amount')::numeric;
        v_item_desc := COALESCE(NULLIF(v_item->>'description', ''), p_concept);
        v_item_qty := COALESCE((v_item->>'quantity')::numeric, 1);
        v_item_price := COALESCE((v_item->>'unit_price')::numeric, CASE WHEN v_item_qty > 0 THEN v_item_amount / v_item_qty ELSE v_item_amount END);
        v_item_code := COALESCE(NULLIF(v_item->>'item_code', ''), 'ITM-' || lpad(v_item_idx::text, 3, '0'));
        v_item_unit := COALESCE(NULLIF(v_item->>'unit_measure_code', ''), 'unit');

        -- Resolve item auxiliar
        v_item_auxiliar := COALESCE((v_item->>'auxiliar_id')::uuid, v_auxiliar_id);
        IF v_item_auxiliar IS NULL THEN
            -- Create fallback auxiliar if none exists
            INSERT INTO budget.tauxiliar (
                household_id, code, name, description, created_by, status
            ) VALUES (
                p_household_id, 'AUX-GEN', 'Auxiliar General', 'Auto-created default auxiliar', v_user_id, 'active'
            ) RETURNING id INTO v_item_auxiliar;
            v_auxiliar_id := v_item_auxiliar;
        END IF;

        -- 10.1 Resolve budget category (tbudget_type)
        SELECT bt.id, bt.name, bt.template_transaction_id
        INTO v_budget_type_id, v_budget_type_name, v_item_template_id
        FROM budget.tbudget_type bt
        WHERE (
            bt.id::text = v_cat_str
            OR bt.category_key = v_cat_str
            OR lower(bt.name) = lower(v_cat_str)
        )
        AND (bt.household_id IS NULL OR bt.household_id = p_household_id)
        AND bt.status = 'active'
        ORDER BY CASE WHEN bt.household_id = p_household_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF v_budget_type_id IS NULL THEN
            RAISE EXCEPTION 'Category not found for identifier: %', v_cat_str;
        END IF;

        -- 10.2 Resolve template_transaction
        v_resolved_template_id := COALESCE(
            (v_item->>'template_transaction_id')::uuid,
            v_item_template_id,
            (SELECT id FROM budget.ttemplate_transaction WHERE code = 'expense_paid' AND household_id=p_household_id AND status='active' LIMIT 1),
            (SELECT id FROM budget.ttemplate_transaction WHERE status = 'active' AND household_id=p_household_id LIMIT 1)
        );

        IF v_resolved_template_id IS NULL THEN
            RAISE EXCEPTION 'No template transaction found for category: % (id: %)', v_budget_type_name, v_budget_type_id;
        END IF;

        IF NOT EXISTS(SELECT 1 FROM budget.ttemplate_transaction WHERE id=v_resolved_template_id
          AND household_id=p_household_id AND status='active' AND deleted_at IS NULL) THEN
          RAISE EXCEPTION 'Template must belong to the household';
        END IF;
        -- Save primary template in header if not set yet
        IF v_header_template_id IS NULL THEN
            v_header_template_id := v_resolved_template_id;
            UPDATE budget.ttransaction
            SET template_transaction_id = v_header_template_id
            WHERE id = v_transaction_id;
        END IF;

        -- 10.3 Query template lines (ttemplate_transaction_det)
        IF NOT EXISTS (
            SELECT 1 FROM budget.ttemplate_transaction_det
            WHERE template_transaction_id = v_resolved_template_id
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Template transaction % has no active detail lines configured', v_resolved_template_id;
        END IF;

        FOR v_template_det IN
            SELECT *
            FROM budget.ttemplate_transaction_det
            WHERE template_transaction_id = v_resolved_template_id
              AND status = 'active'
            ORDER BY line_number ASC
        LOOP
            -- Determine account
            v_det_account_id := COALESCE(
                (v_item->>'account_id')::uuid,
                v_template_det.account_id
            );

            -- Fallback accounts if null in template
            IF v_det_account_id IS NULL THEN
                IF lower(v_template_det.side) = 'debit' THEN
                    SELECT id INTO v_det_account_id FROM budget.taccount WHERE code = '510' AND household_id=p_household_id AND is_postable = true LIMIT 1;
                ELSE
                    SELECT id INTO v_det_account_id FROM budget.taccount WHERE code = '110' AND household_id=p_household_id AND is_postable = true LIMIT 1;
                END IF;
            END IF;

            IF v_det_account_id IS NULL THEN
                SELECT id INTO v_det_account_id FROM budget.taccount WHERE household_id=p_household_id AND is_postable = true LIMIT 1;
            END IF;

            -- Calculate debit/credit base according to side
            IF lower(v_template_det.side) = 'debit' THEN
                v_debit_base := v_item_amount;
                v_credit_base := 0;
            ELSE
                v_debit_base := 0;
                v_credit_base := v_item_amount;
            END IF;

            -- Construct description
            v_line_desc := CASE
                WHEN v_template_det.description_template IS NOT NULL AND trim(v_template_det.description_template) <> ''
                THEN trim(v_template_det.description_template) || ' - ' || v_item_desc
                ELSE v_item_desc
            END;

            -- Insert detail line
            INSERT INTO budget.ttransaction_detail (
                transaction_id,
                account_id,
                auxiliar_id,
                budget_type_id,
                item_code,
                description,
                unit_measure_code,
                quantity,
                unit_price,
                debit_base,
                credit_base,
                created_by,
                status
            ) VALUES (
                v_transaction_id,
                v_det_account_id,
                v_item_auxiliar,
                v_budget_type_id,
                v_item_code,
                v_line_desc,
                v_item_unit,
                v_item_qty,
                v_item_price,
                v_debit_base,
                v_credit_base,
                v_user_id,
                'active'
            )
            RETURNING id INTO v_detail_id;

            v_detail_count := v_detail_count + 1;
            v_details_result := v_details_result || jsonb_build_object(
                'id', v_detail_id,
                'line_number', v_template_det.line_number,
                'side', v_template_det.side,
                'account_id', v_det_account_id,
                'auxiliar_id', v_item_auxiliar,
                'budget_type_id', v_budget_type_id,
                'item_code', v_item_code,
                'description', v_line_desc,
                'debit_base', v_debit_base,
                'credit_base', v_credit_base
            );
        END LOOP;
    END LOOP;

    PERFORM budget.f_check_journal(v_transaction_id);

    -- 11. Return structured result
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transaction registered successfully',
        'transaction', jsonb_build_object(
            'id', v_transaction_id,
            'household_id', p_household_id,
            'operation_code', v_operation_code,
            'concept', p_concept,
            'type', v_type,
            'amount', v_total_amount,
            'transaction_date', COALESCE(p_transaction_date, now()),
            'recorded_via', COALESCE(p_recorded_via, 'app'),
            'template_transaction_id', v_header_template_id
        ),
        'items_count', v_item_count,
        'details_count', v_detail_count,
        'details', v_details_result
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLSTATE,
            'message', SQLERRM
        );
END;
$$;


REVOKE EXECUTE ON FUNCTION budget.f_register_transaction(UUID,VARCHAR,NUMERIC,TEXT,VARCHAR,TIMESTAMPTZ,VARCHAR,VARCHAR,TEXT,VARCHAR,UUID,UUID,JSONB) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.f_register_transaction(UUID,VARCHAR,NUMERIC,TEXT,VARCHAR,TIMESTAMPTZ,VARCHAR,VARCHAR,TEXT,VARCHAR,UUID,UUID,JSONB) FROM PUBLIC,anon;
NOTIFY pgrst,'reload schema';
