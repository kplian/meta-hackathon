-- Original units and USD valuation are different concepts. No FX fetch, yield
-- accrual, quantity update, notification dispatch or scheduled job is added here.
ALTER TABLE budget.tasset_type ADD COLUMN unit_kind VARCHAR(10) NOT NULL DEFAULT 'physical'
 CHECK(unit_kind IN ('physical','security','crypto','fiat'));
UPDATE budget.tasset_type SET unit_kind=CASE WHEN code='crypto' THEN 'crypto' ELSE 'security' END WHERE code IN ('stock','etf','bond','crypto');
INSERT INTO budget.tasset_type(code,name,icon,market_priced,sort_order,account_code,unit_kind) VALUES
 ('savings','Cuenta de ahorro','wallet-outline',false,12,'PATR-savings','fiat'),
 ('term_deposit','Depósito a plazo','time-outline',false,13,'PATR-term_deposit','fiat'),
 ('cash','Dinero disponible','cash-outline',false,14,'PATR-cash','fiat'),
 ('monetary_investment','Otra inversión monetaria','business-outline',false,15,'PATR-monetary_investment','fiat');
ALTER TABLE budget.tasset_position
 ADD COLUMN unit_kind VARCHAR(10) NOT NULL DEFAULT 'physical' CHECK(unit_kind IN ('physical','security','crypto','fiat')),
 ADD COLUMN unit_code VARCHAR(50) NOT NULL DEFAULT 'UNIT',
 ADD COLUMN initial_rate_source VARCHAR(100),
 ADD COLUMN initial_rate_as_of TIMESTAMPTZ,
 ADD COLUMN institution VARCHAR(150),
 ADD COLUMN maturity_date DATE,
 ADD COLUMN registration_options JSONB,
 ADD CONSTRAINT position_unit_code CHECK(length(trim(unit_code))>0 AND (unit_kind<>'fiat' OR unit_code ~ '^[A-Z]{3}$')),
 ADD CONSTRAINT asset_position_household_identity UNIQUE(household_id,id);
UPDATE budget.tasset_position p SET unit_kind=t.unit_kind,
 unit_code=CASE WHEN t.unit_kind='crypto' THEN COALESCE(NULLIF(split_part(p.symbol,'/',1),''),'UNKNOWN')
 WHEN t.unit_kind='security' THEN COALESCE(NULLIF(p.symbol,''),'UNKNOWN') ELSE 'UNIT' END
 FROM budget.tasset_type t WHERE p.asset_type_code=t.code;
COMMENT ON COLUMN budget.tasset_position.quantity IS 'Original holding quantity: e.g. 5 SOL or 5000 BOB. Not a USD balance. Quantity movements will be added by a separate process.';
COMMENT ON COLUMN budget.tasset_position.currency IS 'Accounting and valuation currency (USD), distinct from unit_code.';
COMMENT ON COLUMN budget.tasset_position.initial_rate_source IS 'User-supplied provenance for USD per original unit; no provider verification is implied.';

CREATE TABLE budget.tasset_yield_settings (
 position_id UUID PRIMARY KEY,
 household_id UUID NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT false,
 yield_kind VARCHAR(10) CHECK(yield_kind IN ('interest','rewards','both')),
 reminder_enabled BOOLEAN NOT NULL DEFAULT false,
 reminder_day SMALLINT CHECK(reminder_day BETWEEN 1 AND 31),
 reminder_timezone TEXT NOT NULL DEFAULT 'UTC',
 reminder_start_date DATE,
 notify_user_id UUID,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_by UUID REFERENCES budget.tuser(id),
 FOREIGN KEY(household_id,position_id) REFERENCES budget.tasset_position(household_id,id),
 FOREIGN KEY(household_id,notify_user_id) REFERENCES budget.thousehold_member(household_id,user_id),
 CHECK((enabled AND yield_kind IS NOT NULL) OR (NOT enabled AND yield_kind IS NULL)),
 CHECK((reminder_enabled AND enabled AND reminder_day IS NOT NULL AND reminder_start_date IS NOT NULL AND notify_user_id IS NOT NULL)
 OR (NOT reminder_enabled AND reminder_day IS NULL AND reminder_start_date IS NULL AND notify_user_id IS NULL))
);
COMMENT ON TABLE budget.tasset_yield_settings IS 'Optional interests/rewards and monthly reminder preferences. No yield amounts, accruals, deliveries or schedules are generated.';
COMMENT ON COLUMN budget.tasset_yield_settings.reminder_day IS 'Preferred monthly day. Future dispatcher must clamp 29/30/31 to month end, use timezone, skip inactive positions/members and deduplicate deliveries.';
ALTER TABLE budget.tasset_yield_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON budget.tasset_yield_settings TO authenticated;
GRANT ALL ON budget.tasset_yield_settings TO service_role;
CREATE POLICY yield_settings_read ON budget.tasset_yield_settings FOR SELECT TO authenticated USING(budget.f_is_household_member(household_id));
INSERT INTO budget.tasset_yield_settings(position_id,household_id) SELECT id,household_id FROM budget.tasset_position;

CREATE FUNCTION public.f_configure_asset_yield(p_position_id UUID,p_enabled BOOLEAN,p_yield_kind TEXT DEFAULT NULL,
 p_reminder_enabled BOOLEAN DEFAULT false,p_reminder_day SMALLINT DEFAULT NULL,p_timezone TEXT DEFAULT 'UTC',p_start_date DATE DEFAULT current_date)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE p budget.tasset_position;
BEGIN
 SELECT * INTO STRICT p FROM budget.tasset_position WHERE id=p_position_id FOR UPDATE;
 IF NOT budget.f_is_household_member(p.household_id,true) OR p.status<>'active' OR p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Unauthorized yield settings'; END IF;
 IF p_enabled IS NULL OR p_reminder_enabled IS NULL OR (p_enabled AND (p_yield_kind IS NULL OR p_yield_kind NOT IN ('interest','rewards','both')))
 OR (p_reminder_enabled AND (NOT p_enabled OR p_reminder_day IS NULL OR p_reminder_day NOT BETWEEN 1 AND 31 OR p_start_date IS NULL))
 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Invalid yield or reminder preferences'; END IF;
 INSERT INTO budget.tasset_yield_settings(position_id,household_id,enabled,yield_kind,reminder_enabled,reminder_day,reminder_timezone,reminder_start_date,notify_user_id,updated_by)
 VALUES(p.id,p.household_id,p_enabled,CASE WHEN p_enabled THEN p_yield_kind END,p_reminder_enabled,
 CASE WHEN p_reminder_enabled THEN p_reminder_day END,p_timezone,CASE WHEN p_reminder_enabled THEN p_start_date END,
 CASE WHEN p_reminder_enabled THEN auth.uid() END,auth.uid())
 ON CONFLICT(position_id) DO UPDATE SET enabled=EXCLUDED.enabled,yield_kind=EXCLUDED.yield_kind,
 reminder_enabled=EXCLUDED.reminder_enabled,reminder_day=EXCLUDED.reminder_day,reminder_timezone=EXCLUDED.reminder_timezone,
 reminder_start_date=EXCLUDED.reminder_start_date,notify_user_id=EXCLUDED.notify_user_id,updated_at=now(),updated_by=EXCLUDED.updated_by;
END; $$;
REVOKE ALL ON FUNCTION public.f_configure_asset_yield(UUID,BOOLEAN,TEXT,BOOLEAN,SMALLINT,TEXT,DATE) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_configure_asset_yield(UUID,BOOLEAN,TEXT,BOOLEAN,SMALLINT,TEXT,DATE) TO authenticated;

-- Add new monetary categories to the investment branch of the existing chart.
CREATE OR REPLACE FUNCTION budget.f_ensure_asset_chart(p_household_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE root UUID; investment UUID; physical UUID; capital UUID; account_type UUID; equity_type UUID; investment_aux UUID; asset_aux UUID; t budget.tasset_type;
BEGIN
 SELECT id INTO STRICT account_type FROM budget.taccount_type WHERE code='asset';
 SELECT id INTO STRICT equity_type FROM budget.taccount_type WHERE code='equity';
 SELECT id INTO STRICT investment_aux FROM budget.tauxiliar_type WHERE code='investment';
 SELECT id INTO STRICT asset_aux FROM budget.tauxiliar_type WHERE code='asset';
 INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency,is_postable)
 VALUES(p_household_id,account_type,'PATR-ASSETS','Activos patrimoniales','USD',false),
 (p_household_id,account_type,'PATR-INVESTMENTS','Inversiones financieras','USD',false),
 (p_household_id,account_type,'PATR-PHYSICAL','Bienes y otros activos','USD',false),
 (p_household_id,equity_type,'PATR-EQUITY','Patrimonio en USD','USD',false)
 ON CONFLICT(household_id,code) DO NOTHING;
 SELECT id INTO STRICT root FROM budget.taccount WHERE household_id=p_household_id AND code='PATR-ASSETS';
 SELECT id INTO STRICT investment FROM budget.taccount WHERE household_id=p_household_id AND code='PATR-INVESTMENTS';
 SELECT id INTO STRICT physical FROM budget.taccount WHERE household_id=p_household_id AND code='PATR-PHYSICAL';
 SELECT id INTO STRICT capital FROM budget.taccount WHERE household_id=p_household_id AND code='PATR-EQUITY';
 UPDATE budget.taccount SET parent_id=root WHERE id IN(investment,physical);
 FOR t IN SELECT * FROM budget.tasset_type LOOP
  INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency,parent_id,requires_auxiliar,required_auxiliar_type_id)
  VALUES(p_household_id,account_type,t.account_code,t.name,'USD',CASE WHEN t.code IN ('stock','etf','crypto','bond','savings','term_deposit','monetary_investment') THEN investment ELSE physical END,
   true,CASE WHEN t.market_priced THEN investment_aux ELSE asset_aux END) ON CONFLICT(household_id,code) DO NOTHING;
  UPDATE budget.taccount SET parent_id=CASE WHEN t.code IN ('stock','etf','crypto','bond','savings','term_deposit','monetary_investment') THEN investment ELSE physical END,
   required_auxiliar_type_id=CASE WHEN t.market_priced THEN investment_aux ELSE asset_aux END
  WHERE household_id=p_household_id AND code=t.account_code;
 END LOOP;
 INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency,parent_id)
 VALUES(p_household_id,equity_type,'PATR-OPENING','Patrimonio inicial','USD',capital),
 (p_household_id,equity_type,'PATR-REVALUATION','Ajustes de valoración patrimonial','USD',capital)
 ON CONFLICT(household_id,code) DO NOTHING;
 UPDATE budget.taccount SET parent_id=capital WHERE household_id=p_household_id AND code IN ('PATR-OPENING','PATR-REVALUATION');
END; $$;
DO $$ DECLARE h RECORD; BEGIN
 FOR h IN SELECT id FROM budget.thousehold WHERE deleted_at IS NULL LOOP PERFORM budget.f_ensure_asset_chart(h.id); END LOOP;
END; $$;
DROP FUNCTION public.f_register_household_asset(UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.f_register_household_asset(
 p_household_id UUID, p_asset_type_code TEXT, p_name TEXT, p_quantity NUMERIC,
 p_unit_price_usd NUMERIC, p_price_basis TEXT, p_request_id UUID,
 p_alias TEXT DEFAULT NULL, p_symbol TEXT DEFAULT NULL, p_exchange TEXT DEFAULT NULL,
 p_price_as_of TIMESTAMPTZ DEFAULT NULL,
 p_unit_code TEXT DEFAULT NULL,p_rate_source TEXT DEFAULT NULL,p_rate_as_of TIMESTAMPTZ DEFAULT NULL,
 p_institution TEXT DEFAULT NULL,p_maturity_date DATE DEFAULT NULL,p_yield_settings JSONB DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE
 v_household budget.thousehold;
 v_existing budget.tasset_position;
 v_type budget.tasset_type;
 v_asset_type UUID; v_equity_type UUID; v_aux_type UUID;
 v_account UUID; v_equity UUID; v_aux UUID; v_position UUID;
 v_value NUMERIC(30,8);
 v_tx UUID; v_unit TEXT; v_options JSONB;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM budget.thousehold_member
   WHERE household_id=p_household_id AND user_id=auth.uid() AND role='admin'
   AND status='active' AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'Only a household administrator can register assets';
 END IF;
 SELECT * INTO STRICT v_household FROM budget.thousehold WHERE id=p_household_id AND deleted_at IS NULL FOR UPDATE;
 SELECT * INTO STRICT v_type FROM budget.tasset_type WHERE code=p_asset_type_code;
 v_unit:=COALESCE(NULLIF(upper(trim(p_unit_code)),''),CASE
 WHEN v_type.unit_kind='crypto' THEN NULLIF(split_part(p_symbol,'/',1),'')
 WHEN v_type.unit_kind='security' THEN NULLIF(p_symbol,'') ELSE 'UNIT' END);
 IF v_unit IS NULL OR length(v_unit)>50 OR (v_type.unit_kind='fiat' AND v_unit !~ '^[A-Z]{3}$')
 OR (v_type.unit_kind='fiat' AND v_unit='USD' AND p_unit_price_usd<>1)
 OR length(p_institution)>150 OR length(p_rate_source)>100
 OR (v_type.unit_kind='fiat' AND v_unit<>'USD' AND (NULLIF(trim(p_rate_source),'') IS NULL OR p_rate_as_of IS NULL))
 OR p_rate_as_of>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Specify original unit and initial USD conversion with source and date'; END IF;
 IF p_yield_settings IS NOT NULL AND (jsonb_typeof(p_yield_settings)<>'object' OR EXISTS(
 SELECT 1 FROM jsonb_object_keys(p_yield_settings) k WHERE k NOT IN ('enabled','yield_kind','reminder_enabled','reminder_day','timezone','start_date')))
 THEN RAISE EXCEPTION 'Invalid yield settings'; END IF;
 v_options:=jsonb_build_object('unit_code',v_unit,'rate_source',NULLIF(trim(p_rate_source),''),'rate_as_of',p_rate_as_of,
 'institution',NULLIF(trim(p_institution),''),'maturity_date',p_maturity_date,'yield_settings',COALESCE(p_yield_settings,'{}'::jsonb));
 SELECT * INTO v_existing FROM budget.tasset_position WHERE request_id=p_request_id AND household_id=p_household_id;
 IF FOUND THEN
   IF v_existing.asset_type_code IS DISTINCT FROM p_asset_type_code
      OR v_existing.name IS DISTINCT FROM trim(p_name)
      OR v_existing.alias IS DISTINCT FROM NULLIF(trim(p_alias),'')
      OR v_existing.symbol IS DISTINCT FROM NULLIF(trim(p_symbol),'')
      OR v_existing.exchange IS DISTINCT FROM NULLIF(trim(p_exchange),'')
      OR v_existing.quantity IS DISTINCT FROM round(p_quantity,12)
      OR v_existing.reference_unit_price_usd IS DISTINCT FROM round(p_unit_price_usd,10)
      OR v_existing.price_basis IS DISTINCT FROM p_price_basis
      OR v_existing.price_as_of IS DISTINCT FROM p_price_as_of THEN
     RAISE EXCEPTION 'Request ID already registered with different asset data';
   END IF;
   IF v_existing.registration_options IS NOT NULL AND v_existing.registration_options<>v_options THEN RAISE EXCEPTION 'Request ID already registered with different original units or yield preferences'; END IF;
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
 IF p_price_basis='market_estimate' AND (NOT v_type.market_priced OR p_price_as_of IS NULL OR p_price_as_of>now()+interval '5 minutes') THEN
   RAISE EXCEPTION 'A market estimate requires a quote timestamp';
 END IF;
 v_value:=round(round(p_quantity,12)*round(p_unit_price_usd,10),8);
 IF v_value<=0 THEN RAISE EXCEPTION 'Asset value is too small'; END IF;
 SELECT id INTO STRICT v_asset_type FROM budget.taccount_type WHERE code='asset';
 SELECT id INTO STRICT v_equity_type FROM budget.taccount_type WHERE code='equity';
 PERFORM budget.f_ensure_asset_chart(p_household_id);
 SELECT id INTO STRICT v_aux_type FROM budget.tauxiliar_type WHERE code=CASE WHEN v_type.market_priced THEN 'investment' ELSE 'asset' END;
 INSERT INTO budget.taccount(household_id,account_type_id,business_type_id,code,name,currency,requires_auxiliar,required_auxiliar_type_id,created_by)
 VALUES(p_household_id,v_asset_type,v_household.business_type_id,v_type.account_code,'Patrimonio - '||v_type.name,'USD',true,v_aux_type,auth.uid())
 ON CONFLICT(household_id,code) DO NOTHING;
 SELECT id INTO STRICT v_account FROM budget.taccount WHERE household_id=p_household_id AND code=v_type.account_code AND currency='USD';
 INSERT INTO budget.taccount(household_id,account_type_id,business_type_id,code,name,currency,created_by)
 VALUES(p_household_id,v_equity_type,v_household.business_type_id,'PATR-OPENING','Patrimonio inicial','USD',auth.uid())
 ON CONFLICT(household_id,code) DO NOTHING;
 SELECT id INTO STRICT v_equity FROM budget.taccount WHERE household_id=p_household_id AND code='PATR-OPENING' AND currency='USD';
 v_position:=gen_random_uuid();
 INSERT INTO budget.tauxiliar(household_id,auxiliar_type_id,code,name,description,created_by,status)
 VALUES(p_household_id,v_aux_type,'ASSET-'||v_position::text,COALESCE(NULLIF(trim(p_alias),''),trim(p_name)),'Activo patrimonial en USD',auth.uid(),'active')
 RETURNING id INTO v_aux;
 INSERT INTO budget.tasset_position(id,request_id,household_id,asset_type_code,name,alias,symbol,exchange,quantity,
 reference_unit_price_usd,opening_value_usd,price_basis,price_as_of,price_provider,account_id,auxiliar_id,created_by,unit_kind,unit_code,initial_rate_source,initial_rate_as_of,institution,maturity_date,registration_options)
 VALUES(v_position,p_request_id,p_household_id,v_type.code,trim(p_name),NULLIF(trim(p_alias),''),NULLIF(trim(p_symbol),''),NULLIF(trim(p_exchange),''),
 p_quantity,p_unit_price_usd,v_value,p_price_basis,p_price_as_of,CASE WHEN p_price_basis='market_estimate' THEN 'twelve_data' ELSE NULL END,v_account,v_aux,auth.uid(),v_type.unit_kind,v_unit,NULLIF(trim(p_rate_source),''),p_rate_as_of,NULLIF(trim(p_institution),''),p_maturity_date,v_options);
 INSERT INTO budget.ttransaction(household_id,concept,type,amount,currency,ledger_book,recorded_via,created_by,input_data)
 VALUES(p_household_id,COALESCE(NULLIF(trim(p_alias),''),trim(p_name)),'opening_balance',v_value,'USD','patrimony','onboarding',auth.uid(),jsonb_build_object('asset_position_id',v_position)) RETURNING id INTO v_tx;
 INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,quantity,unit_price,debit_base,credit_base,created_by)
 VALUES(v_tx,v_account,v_aux,trim(p_name),p_quantity,p_unit_price_usd,v_value,0,auth.uid()),
       (v_tx,v_equity,v_aux,'Patrimonio inicial',0,0,0,v_value,auth.uid());
 UPDATE budget.tasset_position SET opening_transaction_id=v_tx WHERE id=v_position;
 PERFORM public.f_configure_asset_yield(v_position,COALESCE((p_yield_settings->>'enabled')::boolean,false),p_yield_settings->>'yield_kind',
 COALESCE((p_yield_settings->>'reminder_enabled')::boolean,false),(p_yield_settings->>'reminder_day')::smallint,
 COALESCE(p_yield_settings->>'timezone','UTC'),COALESCE((p_yield_settings->>'start_date')::date,current_date));
 PERFORM budget.f_check_journal(v_tx);
 RETURN v_position;
END;
$$;




REVOKE ALL ON FUNCTION public.f_register_household_asset(UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,TEXT,DATE,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_register_household_asset(UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,TEXT,DATE,JSONB) TO authenticated;
NOTIFY pgrst,'reload schema';
