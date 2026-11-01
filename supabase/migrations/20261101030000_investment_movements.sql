-- Purchases, sales and transfers use the existing journal. This table only links
-- the operation, its two endpoints and (when needed) two balanced currency books.
ALTER TABLE budget.tasset_position ADD COLUMN registration_kind TEXT NOT NULL DEFAULT 'opening'
 CHECK(registration_kind IN ('opening','purchase'));
COMMENT ON COLUMN budget.tasset_position.opening_value_usd IS 'Initial declared value or first purchase cost; registration_kind distinguishes them. Current balances come from the journal.';
CREATE TABLE budget.tasset_movement (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), household_id UUID NOT NULL REFERENCES budget.thousehold(id),
 request_id UUID NOT NULL UNIQUE, payload JSONB NOT NULL,
 source_account_id UUID REFERENCES budget.taccount(id), source_position_id UUID REFERENCES budget.tasset_position(id),
 destination_account_id UUID REFERENCES budget.taccount(id), destination_position_id UUID REFERENCES budget.tasset_position(id),
 source_quantity NUMERIC(30,12) NOT NULL CHECK(source_quantity>0),
 destination_quantity NUMERIC(30,12) NOT NULL CHECK(destination_quantity>0),
 settlement_usd NUMERIC(30,8), usd_per_household_unit NUMERIC(30,10),
 carrying_removed_usd NUMERIC(30,8), realized_result_usd NUMERIC(30,8),
 operating_transaction_id UUID UNIQUE REFERENCES budget.ttransaction(id),
 patrimony_transaction_id UUID UNIQUE REFERENCES budget.ttransaction(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID NOT NULL REFERENCES budget.tuser(id),
 CHECK((source_account_id IS NULL)<>(source_position_id IS NULL)),
 CHECK((destination_account_id IS NULL)<>(destination_position_id IS NULL))
);
CREATE INDEX asset_movement_household ON budget.tasset_movement(household_id,created_at DESC);
ALTER TABLE budget.tasset_movement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON budget.tasset_movement FROM anon,authenticated;
GRANT SELECT ON budget.tasset_movement TO authenticated;
GRANT ALL ON budget.tasset_movement TO service_role;
CREATE POLICY movement_read ON budget.tasset_movement FOR SELECT TO authenticated USING(budget.f_is_household_member(household_id));

CREATE FUNCTION budget.f_operating_available(p_household UUID,p_account UUID) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
 SELECT COALESCE(sum(d.debit_base-d.credit_base),0)
 FROM budget.thousehold h JOIN budget.taccount target ON target.id=p_account AND target.household_id=h.id
 JOIN budget.taccount a ON a.code=target.code AND (a.household_id=h.id OR (a.household_id IS NULL AND a.business_type_id=h.business_type_id))
 JOIN budget.ttransaction_detail d ON d.account_id=a.id JOIN budget.ttransaction t ON t.id=d.transaction_id
 WHERE h.id=p_household AND t.household_id=h.id AND t.ledger_book='operating' AND t.currency=h.currency
 AND t.transaction_date<=now() AND t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION budget.f_operating_available(UUID,UUID) FROM PUBLIC,anon,authenticated;

-- All cash writers serialize with investment movements, including ordinary journal RPCs.
CREATE FUNCTION budget.f_lock_operating_liquidity() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE home UUID;
BEGIN
 SELECT t.household_id INTO home FROM budget.ttransaction t JOIN budget.taccount a ON a.id=NEW.account_id
 WHERE t.id=NEW.transaction_id AND t.ledger_book='operating' AND a.code IN ('110','111','112');
 IF home IS NOT NULL THEN PERFORM 1 FROM budget.thousehold WHERE id=home FOR UPDATE; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER operating_liquidity_lock BEFORE INSERT ON budget.ttransaction_detail FOR EACH ROW EXECUTE FUNCTION budget.f_lock_operating_liquidity();
REVOKE ALL ON FUNCTION budget.f_lock_operating_liquidity() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.f_investment_overview(p_household_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; result JSONB;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL;
 SELECT jsonb_build_object('currency',trim(h.currency),'can_manage',budget.f_is_household_member(h.id,true),
 'available',COALESCE(sum(b.balance),0),'accounts',COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.code),'[]'::jsonb),
 'wealth',public.f_household_wealth_report(h.id),
 'history',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at DESC) FROM (
 SELECT m.id,m.created_at,m.source_quantity,m.destination_quantity,m.settlement_usd,m.realized_result_usd,
 COALESCE(sp.alias,sp.name,sa.name) source_name,COALESCE(dp.alias,dp.name,da.name) destination_name,
 COALESCE(sp.unit_code,trim(h.currency)) source_unit,COALESCE(dp.unit_code,trim(h.currency)) destination_unit
 FROM budget.tasset_movement m LEFT JOIN budget.tasset_position sp ON sp.id=m.source_position_id
 LEFT JOIN budget.tasset_position dp ON dp.id=m.destination_position_id
 LEFT JOIN budget.taccount sa ON sa.id=m.source_account_id LEFT JOIN budget.taccount da ON da.id=m.destination_account_id
 WHERE m.household_id=h.id ORDER BY m.created_at DESC,m.id LIMIT 30) m),'[]'::jsonb)) INTO result
 FROM (SELECT a.id,a.code,a.name,trim(a.currency) currency,budget.f_operating_available(h.id,a.id) balance
 FROM budget.taccount a WHERE a.household_id=h.id AND a.code IN ('110','111','112') AND a.currency=h.currency
 AND a.is_postable AND a.status='active' AND a.deleted_at IS NULL) b;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_investment_overview(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_investment_overview(UUID) TO authenticated;

CREATE FUNCTION public.f_move_investment(p_household_id UUID,p_request_id UUID,p_source JSONB,p_destination JSONB,
 p_source_quantity NUMERIC,p_destination_quantity NUMERIC,p_settlement_usd NUMERIC DEFAULT NULL,
 p_usd_per_household_unit NUMERIC DEFAULT NULL,p_note TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE
 h budget.thousehold; existing budget.tasset_movement; src budget.tasset_position; dst budget.tasset_position;
 sa budget.taccount; da budget.taccount; typ budget.tasset_type; payload JSONB; draft JSONB;
 mid UUID:=gen_random_uuid(); op UUID; patr UUID; aux UUID; atype UUID; account UUID; opbridge UUID; usdbridge UUID; gain UUID; loss UUID;
 sq NUMERIC:=round(p_source_quantity,12); dq NUMERIC:=round(p_destination_quantity,12); usd NUMERIC:=round(p_settlement_usd,8);
 fx NUMERIC:=round(p_usd_per_household_unit,10); available NUMERIC; units NUMERIC; carrying NUMERIC; removed NUMERIC:=0; result NUMERIC:=0;
 source_is_cash BOOLEAN; destination_is_cash BOOLEAN; same_instrument BOOLEAN:=false; unit TEXT; kind TEXT; cost NUMERIC; tx_type TEXT;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id,true) THEN RAISE EXCEPTION 'Only a household administrator can move investments'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL FOR UPDATE;
 payload:=jsonb_build_object('source',p_source,'destination',p_destination,'source_quantity',sq,'destination_quantity',dq,
 'settlement_usd',usd,'usd_per_household_unit',fx,'note',NULLIF(trim(p_note),''));
 SELECT * INTO existing FROM budget.tasset_movement WHERE request_id=p_request_id;
 IF FOUND THEN
  IF existing.household_id<>h.id OR existing.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Request ID already used with different movement data'; END IF;
  RETURN existing.id;
 END IF;
 IF p_request_id IS NULL OR sq IS NULL OR dq IS NULL OR NOT(sq>0 AND sq<1e18) OR NOT(dq>0 AND dq<1e18)
 OR length(p_note)>200 OR jsonb_typeof(p_source) IS DISTINCT FROM 'object' OR jsonb_typeof(p_destination) IS DISTINCT FROM 'object'
 OR p_source->>'kind' IS NULL OR p_source->>'kind' NOT IN ('operating','position')
 OR p_destination->>'kind' IS NULL OR p_destination->>'kind' NOT IN ('operating','position','new') THEN RAISE EXCEPTION 'Invalid movement'; END IF;
 source_is_cash:=p_source->>'kind'='operating'; destination_is_cash:=p_destination->>'kind'='operating';
 IF source_is_cash THEN
  SELECT * INTO STRICT sa FROM budget.taccount WHERE id=(p_source->>'id')::uuid AND household_id=h.id
   AND code IN ('110','111','112') AND currency=h.currency AND is_postable AND status='active' AND deleted_at IS NULL;
  available:=budget.f_operating_available(h.id,sa.id);
  IF sq>available THEN RAISE EXCEPTION 'Insufficient available money'; END IF;
 ELSE
  SELECT * INTO STRICT src FROM budget.tasset_position WHERE id=(p_source->>'id')::uuid AND household_id=h.id AND status='active' AND deleted_at IS NULL FOR UPDATE;
  SELECT COALESCE(quantity,0) INTO units FROM budget.vasset_quantity_balance WHERE asset_position_id=src.id;
  IF units IS NULL OR sq>units THEN RAISE EXCEPTION 'Insufficient asset units'; END IF;
  IF EXISTS(SELECT 1 FROM budget.ttransaction_detail d JOIN budget.ttransaction t ON t.id=d.transaction_id
   WHERE d.account_id=src.account_id AND d.auxiliar_id=src.auxiliar_id AND d.asset_quantity_delta IS NULL
   AND t.household_id=h.id AND t.ledger_book='patrimony' AND t.status='active' AND t.deleted_at IS NULL
   AND d.status='active' AND d.deleted_at IS NULL AND t.type NOT IN ('opening_balance','valuation_adjustment')) THEN
   RAISE EXCEPTION 'Legacy movements require unit reconciliation before withdrawal'; END IF;
  SELECT COALESCE(sum(d.debit_base-d.credit_base),0) INTO carrying FROM budget.ttransaction_detail d JOIN budget.ttransaction t ON t.id=d.transaction_id
   WHERE d.account_id=src.account_id AND d.auxiliar_id=src.auxiliar_id AND t.household_id=h.id AND t.ledger_book='patrimony' AND t.currency='USD'
   AND t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL AND t.transaction_date<=now();
  IF carrying<=0 THEN RAISE EXCEPTION 'Position requires carrying value reconciliation'; END IF;
  removed:=CASE WHEN sq=units THEN carrying ELSE round(carrying*sq/units,8) END;
  IF removed<=0 THEN RAISE EXCEPTION 'Movement value is too small'; END IF;
 END IF;
 IF destination_is_cash THEN
  SELECT * INTO STRICT da FROM budget.taccount WHERE id=(p_destination->>'id')::uuid AND household_id=h.id
   AND code IN ('110','111','112') AND currency=h.currency AND is_postable AND status='active' AND deleted_at IS NULL;
  IF source_is_cash AND (sa.id=da.id OR sq<>dq) THEN RAISE EXCEPTION 'Choose different accounts and equal amounts'; END IF;
 ELSIF p_destination->>'kind'='position' THEN
  SELECT * INTO STRICT dst FROM budget.tasset_position WHERE id=(p_destination->>'id')::uuid AND household_id=h.id AND status='active' AND deleted_at IS NULL FOR UPDATE;
  IF src.id=dst.id THEN RAISE EXCEPTION 'Choose different positions'; END IF;
 END IF;
 IF NOT source_is_cash AND NOT destination_is_cash AND dst.id IS NOT NULL THEN
  same_instrument:=src.unit_kind=dst.unit_kind AND src.unit_code=dst.unit_code AND
   ((src.unit_kind='fiat') OR (src.instrument_quote_id IS NOT NULL AND src.instrument_quote_id=dst.instrument_quote_id));
 END IF;
 IF source_is_cash AND destination_is_cash THEN
  usd:=NULL; fx:=NULL;
 ELSE
  IF usd IS NULL OR NOT(usd>0 AND usd<1e22) THEN RAISE EXCEPTION 'Specify a positive settlement value in USD'; END IF;
  IF source_is_cash OR destination_is_cash THEN
   IF fx IS NULL OR NOT(fx>0 AND fx<1e18) OR (h.currency='USD' AND fx<>1)
   OR abs(usd-round((CASE WHEN source_is_cash THEN sq ELSE dq END)*fx,8))>0.00000001 THEN RAISE EXCEPTION 'USD settlement must match actual household amount and exchange rate'; END IF;
  ELSE fx:=NULL; END IF;
  IF (src.unit_kind='fiat' AND src.unit_code='USD' AND sq<>usd) OR (dst.unit_kind='fiat' AND dst.unit_code='USD' AND dq<>usd) THEN RAISE EXCEPTION 'USD positions require one dollar per unit'; END IF;
  IF same_instrument AND sq<>dq THEN RAISE EXCEPTION 'A custody transfer must preserve units'; END IF;
 END IF;
 PERFORM budget.f_ensure_asset_chart(h.id);
 SELECT id INTO STRICT atype FROM budget.tauxiliar_type WHERE code='asset';
 INSERT INTO budget.tauxiliar(household_id,auxiliar_type_id,code,name,created_by) VALUES(h.id,atype,'INVESTMENT-MOVEMENTS','Movimientos de ahorros e inversiones',auth.uid()) ON CONFLICT(household_id,code) DO NOTHING;
 SELECT id INTO STRICT aux FROM budget.tauxiliar WHERE household_id=h.id AND code='INVESTMENT-MOVEMENTS' AND status='active' AND deleted_at IS NULL;
 -- A new purchase creates its position without an opening-equity posting.
 IF p_destination->>'kind'='new' THEN
  draft:=p_destination->'asset';
  SELECT * INTO STRICT typ FROM budget.tasset_type WHERE code=draft->>'type';
  unit:=COALESCE(NULLIF(upper(trim(draft->>'unit_code')),''),CASE WHEN typ.unit_kind='crypto' THEN split_part(draft->>'symbol','/',1)
   WHEN typ.unit_kind='security' THEN draft->>'symbol' ELSE 'UNIT' END);
  IF NULLIF(trim(draft->>'name'),'') IS NULL OR length(trim(draft->>'name'))>150 OR length(draft->>'alias')>100
   OR length(draft->>'symbol')>50 OR length(draft->>'exchange')>100 OR length(draft->>'institution')>150
   OR unit IS NULL OR length(unit) NOT BETWEEN 1 AND 50 OR (typ.unit_kind='fiat' AND unit NOT IN (trim(h.currency),'USD'))
   OR (typ.market_priced AND NULLIF(trim(draft->>'symbol'),'') IS NULL) OR (typ.unit_kind='fiat' AND unit='USD' AND dq<>usd)
   THEN RAISE EXCEPTION 'Invalid new investment identity or currency'; END IF;
  SELECT id INTO STRICT atype FROM budget.tauxiliar_type WHERE code=CASE WHEN typ.market_priced THEN 'investment' ELSE 'asset' END;
  dst.id:=gen_random_uuid();
  INSERT INTO budget.tauxiliar(household_id,auxiliar_type_id,code,name,created_by)
   VALUES(h.id,atype,'ASSET-'||dst.id,COALESCE(NULLIF(trim(draft->>'alias'),''),trim(draft->>'name')),auth.uid()) RETURNING id INTO dst.auxiliar_id;
  SELECT id INTO STRICT dst.account_id FROM budget.taccount WHERE household_id=h.id AND code=typ.account_code AND currency='USD';
  INSERT INTO budget.tasset_position(id,request_id,household_id,asset_type_code,name,alias,symbol,exchange,quantity,reference_unit_price_usd,
   opening_value_usd,price_basis,price_as_of,account_id,auxiliar_id,created_by,unit_kind,unit_code,institution,maturity_date,registration_kind,initial_rate_source,initial_rate_as_of)
   VALUES(dst.id,p_request_id,h.id,typ.code,trim(draft->>'name'),NULLIF(trim(draft->>'alias'),''),NULLIF(trim(draft->>'symbol'),''),NULLIF(trim(draft->>'exchange'),''),
   dq,round(usd/dq,10),usd,'purchase_price',now(),dst.account_id,dst.auxiliar_id,auth.uid(),typ.unit_kind,unit,NULLIF(trim(draft->>'institution'),''),NULLIF(draft->>'maturity_date','')::date,'purchase',CASE WHEN typ.unit_kind='fiat' THEN 'executed_transaction' END,CASE WHEN typ.unit_kind='fiat' THEN now() END)
   RETURNING * INTO dst;
  PERFORM public.f_configure_asset_yield(dst.id,COALESCE((draft->'yield_settings'->>'enabled')::boolean,false),draft->'yield_settings'->>'yield_kind',
   COALESCE((draft->'yield_settings'->>'reminder_enabled')::boolean,false),(draft->'yield_settings'->>'reminder_day')::smallint,
   COALESCE(draft->'yield_settings'->>'timezone','UTC'));
 END IF;
 IF NOT source_is_cash AND NOT destination_is_cash THEN
  same_instrument:=src.unit_kind=dst.unit_kind AND src.unit_code=dst.unit_code AND
   (src.unit_kind='fiat' OR (src.instrument_quote_id IS NOT NULL AND src.instrument_quote_id=dst.instrument_quote_id));
  IF same_instrument AND sq<>dq THEN RAISE EXCEPTION 'A custody transfer must preserve units'; END IF;
 END IF;
 -- Explicit counterpart accounts connect independently balanced books. Convert
 -- and eliminate this pair when consolidating, never add nominal BOB and USD.
 IF source_is_cash OR destination_is_cash THEN
  SELECT id INTO STRICT atype FROM budget.taccount_type WHERE code='asset';
  INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency,created_by)
   VALUES(h.id,atype,'INV-BRIDGE','Enlace con inversiones',h.currency,auth.uid()),(h.id,atype,'PATR-BRIDGE','Enlace con dinero operativo','USD',auth.uid()) ON CONFLICT(household_id,code) DO NOTHING;
  SELECT id INTO STRICT opbridge FROM budget.taccount WHERE household_id=h.id AND code='INV-BRIDGE' AND currency=h.currency;
  SELECT id INTO STRICT usdbridge FROM budget.taccount WHERE household_id=h.id AND code='PATR-BRIDGE' AND currency='USD';
  INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book,concept,recorded_via,created_by,input_data)
   VALUES(h.id,'transfer',CASE WHEN source_is_cash THEN sq ELSE dq END,h.currency,'operating',COALESCE(NULLIF(trim(p_note),''),'Movimiento de ahorro e inversión'),'investments',auth.uid(),jsonb_build_object('investment_movement_id',mid)) RETURNING id INTO op;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,created_by) VALUES
   (op,CASE WHEN destination_is_cash THEN da.id ELSE opbridge END,aux,'Entrada',CASE WHEN source_is_cash THEN sq ELSE dq END,0,auth.uid()),
   (op,CASE WHEN source_is_cash THEN sa.id ELSE opbridge END,aux,'Salida',0,CASE WHEN source_is_cash THEN sq ELSE dq END,auth.uid());
 END IF;
 IF NOT(source_is_cash AND destination_is_cash) THEN
  cost:=CASE WHEN same_instrument THEN removed ELSE usd END;
  result:=CASE WHEN source_is_cash OR same_instrument THEN 0 ELSE usd-removed END;
  tx_type:=CASE WHEN same_instrument THEN 'transfer' WHEN source_is_cash THEN 'asset_purchase' WHEN destination_is_cash THEN 'asset_sale' ELSE 'transfer' END;
  INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book,concept,recorded_via,created_by,input_data)
   VALUES(h.id,tx_type,greatest(cost,removed),'USD','patrimony',COALESCE(NULLIF(trim(p_note),''),'Movimiento de ahorro e inversión'),'investments',auth.uid(),
   jsonb_build_object('investment_movement_id',mid,'source_position_id',src.id,'destination_position_id',dst.id,'cost_policy','weighted_average_carrying_value')) RETURNING id INTO patr;
  INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,asset_position_id,asset_quantity_delta,created_by) VALUES
   (patr,CASE WHEN destination_is_cash THEN usdbridge ELSE dst.account_id END,CASE WHEN destination_is_cash THEN aux ELSE dst.auxiliar_id END,'Entrada de inversión',cost,0,CASE WHEN NOT destination_is_cash THEN dst.id END,CASE WHEN NOT destination_is_cash THEN dq END,auth.uid()),
   (patr,CASE WHEN source_is_cash THEN usdbridge ELSE src.account_id END,CASE WHEN source_is_cash THEN aux ELSE src.auxiliar_id END,'Salida de inversión',0,CASE WHEN source_is_cash THEN usd ELSE removed END,CASE WHEN NOT source_is_cash THEN src.id END,CASE WHEN NOT source_is_cash THEN -sq END,auth.uid());
  IF result<>0 THEN
   SELECT id INTO STRICT atype FROM budget.taccount_type WHERE code=CASE WHEN result>0 THEN 'income' ELSE 'expense' END;
   INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency,created_by)
    VALUES(h.id,atype,CASE WHEN result>0 THEN 'PATR-REALIZED-GAIN' ELSE 'PATR-REALIZED-LOSS' END,
    CASE WHEN result>0 THEN 'Ganancia realizada de inversiones' ELSE 'Pérdida realizada de inversiones' END,'USD',auth.uid()) ON CONFLICT(household_id,code) DO NOTHING;
   SELECT id INTO STRICT account FROM budget.taccount WHERE household_id=h.id AND code=CASE WHEN result>0 THEN 'PATR-REALIZED-GAIN' ELSE 'PATR-REALIZED-LOSS' END;
   INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,created_by)
    VALUES(patr,account,aux,'Resultado realizado (gestión)',greatest(-result,0),greatest(result,0),auth.uid());
  END IF;
 END IF;
 INSERT INTO budget.tasset_movement(id,household_id,request_id,payload,source_account_id,source_position_id,destination_account_id,destination_position_id,
 source_quantity,destination_quantity,settlement_usd,usd_per_household_unit,carrying_removed_usd,realized_result_usd,operating_transaction_id,patrimony_transaction_id,created_by)
 VALUES(mid,h.id,p_request_id,payload,sa.id,src.id,da.id,dst.id,sq,dq,usd,fx,removed,result,op,patr,auth.uid());
 IF op IS NOT NULL THEN PERFORM budget.f_check_journal(op); END IF;
 IF patr IS NOT NULL THEN PERFORM budget.f_check_journal(patr); END IF;
 RETURN mid;
END $$;
REVOKE ALL ON FUNCTION public.f_move_investment(UUID,UUID,JSONB,JSONB,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_move_investment(UUID,UUID,JSONB,JSONB,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT) TO authenticated;

-- Linked operating postings must be just as immutable as patrimonial postings.
CREATE OR REPLACE FUNCTION budget.f_protect_patrimony_journal() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=budget,public AS $$
DECLARE t budget.ttransaction;
BEGIN
 IF TG_TABLE_NAME='ttransaction' THEN t:=OLD; ELSE SELECT * INTO t FROM budget.ttransaction WHERE id=OLD.transaction_id; END IF;
 IF t.ledger_book='patrimony' OR t.input_data ? 'investment_movement_id' THEN RAISE EXCEPTION 'Investment postings are immutable; use a reversing entry'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE FUNCTION budget.f_protect_used_asset() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
BEGIN
 IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) AND EXISTS(
 SELECT 1 FROM budget.tasset_movement WHERE source_position_id=OLD.id OR destination_position_id=OLD.id) THEN
 RAISE EXCEPTION 'An investment with movements cannot be removed; sell or transfer its remaining units'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER used_asset_immutable BEFORE UPDATE ON budget.tasset_position FOR EACH ROW EXECUTE FUNCTION budget.f_protect_used_asset();
REVOKE ALL ON FUNCTION budget.f_protect_used_asset() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.f_move_investment(UUID,UUID,JSONB,JSONB,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT) IS 'Authorized atomic and idempotent investment movements; explicit units, weighted-average carrying value, paired books for household cash and USD assets. Not a brokerage execution or tax lot engine.';
-- Valuation snapshots and optional postings must follow moved units, not the original opening quantity.
CREATE OR REPLACE FUNCTION budget.f_record_asset_valuation(p_position_id UUID,p_unit_price_usd NUMERIC,p_valued_at TIMESTAMPTZ,
 p_request_id UUID,p_source TEXT,p_method TEXT,p_notes TEXT,p_actor_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE p budget.tasset_position; existing budget.tasset_valuation; result UUID; held_units NUMERIC;
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
 SELECT COALESCE(sum(d.asset_quantity_delta),0) INTO held_units FROM budget.ttransaction_detail d JOIN budget.ttransaction t ON t.id=d.transaction_id
 WHERE d.asset_position_id=p.id AND t.transaction_date<=p_valued_at AND t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL;
 -- Backdated reference observations for an already-owned opening keep its declared quantity; they cannot be posted as a current valuation.
 IF held_units=0 AND p.registration_kind='opening' AND p_valued_at<p.created_at THEN held_units:=p.quantity; END IF;
 IF held_units<=0 THEN RAISE EXCEPTION 'No held units at the valuation date'; END IF;
 INSERT INTO budget.tasset_valuation(position_id,household_id,request_id,unit_price_usd,quantity,value_usd,valued_at,source,method,notes,recorded_by)
 VALUES(p.id,p.household_id,p_request_id,p_unit_price_usd,held_units,round(round(p_unit_price_usd,10)*held_units,8),p_valued_at,p_source,p_method,NULLIF(trim(p_notes),''),p_actor_id)
 RETURNING id INTO result;
 RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.f_post_asset_valuation(p_valuation_id UUID) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE v budget.tasset_valuation; p budget.tasset_position; delta NUMERIC; carrying NUMERIC; reserve UUID; tx UUID; equity UUID; held_units NUMERIC;
BEGIN
 SELECT * INTO STRICT v FROM budget.tasset_valuation WHERE id=p_valuation_id;
 SELECT * INTO STRICT p FROM budget.tasset_position WHERE id=v.position_id FOR UPDATE;
 SELECT * INTO STRICT v FROM budget.tasset_valuation WHERE id=p_valuation_id FOR UPDATE;
 IF NOT budget.f_is_household_member(p.household_id,true) OR p.status<>'active' OR p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Unauthorized valuation posting'; END IF;
 IF v.posted_at IS NOT NULL THEN RETURN v.posted_transaction_id; END IF;
 SELECT COALESCE(quantity,0) INTO held_units FROM budget.vasset_quantity_balance WHERE asset_position_id=p.id;
 IF held_units IS DISTINCT FROM v.quantity THEN RAISE EXCEPTION 'Asset units changed; record a new valuation before posting'; END IF;
 IF v.source='opening' OR v.valued_at<(SELECT max(valued_at) FROM budget.tasset_valuation WHERE position_id=p.id)
 OR EXISTS(SELECT 1 FROM budget.ttransaction t JOIN budget.ttransaction_detail d ON d.transaction_id=t.id
 WHERE d.asset_position_id=p.id AND t.transaction_date>v.valued_at AND t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL)
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

NOTIFY pgrst,'reload schema';
