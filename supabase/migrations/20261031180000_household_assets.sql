-- Opening assets are USD patrimony, not income, expenses, or a new purchase.
CREATE TABLE budget.tasset_type (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    market_priced BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL
);
INSERT INTO budget.tasset_type(code,name,icon,market_priced,sort_order) VALUES
 ('house','Casa','home-outline',false,1),
 ('apartment','Departamento','business-outline',false,2),
 ('land','Terreno','map-outline',false,3),
 ('vehicle','Vehículo','car-outline',false,4),
 ('stock','Acciones','trending-up-outline',true,5),
 ('etf','ETF','layers-outline',true,6),
 ('crypto','Criptomonedas','logo-bitcoin',true,7),
 ('bond','Bonos','document-text-outline',false,8),
 ('business','Negocio','storefront-outline',false,9),
 ('precious_metal','Metales preciosos','diamond-outline',false,10),
 ('other','Otro activo','cube-outline',false,11);

CREATE TABLE budget.tasset_position (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL UNIQUE,
    household_id UUID NOT NULL REFERENCES budget.thousehold(id),
    asset_type_code VARCHAR(30) NOT NULL REFERENCES budget.tasset_type(code),
    name VARCHAR(150) NOT NULL CHECK(length(trim(name))>0),
    alias VARCHAR(100),
    symbol VARCHAR(50),
    exchange VARCHAR(100),
    quantity NUMERIC(30,12) NOT NULL CHECK(quantity>0),
    reference_unit_price_usd NUMERIC(30,10) NOT NULL CHECK(reference_unit_price_usd>0),
    opening_value_usd NUMERIC(30,8) NOT NULL CHECK(opening_value_usd>0),
    currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
    price_basis VARCHAR(30) NOT NULL CHECK(price_basis IN ('purchase_price','market_estimate','estimated_value')),
    price_as_of TIMESTAMPTZ,
    price_provider VARCHAR(30),
    account_id UUID NOT NULL REFERENCES budget.taccount(id),
    auxiliar_id UUID NOT NULL REFERENCES budget.tauxiliar(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES budget.tuser(id),
    status VARCHAR(15) NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES budget.tuser(id)
);
CREATE INDEX ON budget.tasset_position(household_id);

-- Dedicated opening journal: two balanced USD lines per registered position.
-- Keeping this separate prevents polluting the daily income/expense journal.
CREATE TABLE budget.tasset_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES budget.tasset_position(id),
    household_id UUID NOT NULL REFERENCES budget.thousehold(id),
    account_id UUID NOT NULL REFERENCES budget.taccount(id),
    auxiliar_id UUID NOT NULL REFERENCES budget.tauxiliar(id),
    side VARCHAR(6) NOT NULL CHECK(side IN ('debit','credit')),
    amount_usd NUMERIC(30,8) NOT NULL CHECK(amount_usd>0),
    currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
    entry_type VARCHAR(20) NOT NULL DEFAULT 'opening_balance' CHECK(entry_type='opening_balance'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES budget.tuser(id),
    status VARCHAR(15) NOT NULL DEFAULT 'active' CHECK(status IN ('active','voided')),
    UNIQUE(position_id,side)
);
CREATE INDEX ON budget.tasset_entry(household_id);
ALTER TABLE budget.tasset_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget.tasset_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget.tasset_entry ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON budget.tasset_type,budget.tasset_position,budget.tasset_entry TO authenticated;
GRANT ALL ON budget.tasset_type,budget.tasset_position,budget.tasset_entry TO service_role;
CREATE POLICY asset_types_read ON budget.tasset_type FOR SELECT TO authenticated USING(true);
CREATE POLICY assets_read ON budget.tasset_position FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM budget.thousehold_member m WHERE m.household_id=tasset_position.household_id
 AND m.user_id=auth.uid() AND m.status='active' AND m.deleted_at IS NULL
));
CREATE POLICY asset_entries_read ON budget.tasset_entry FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM budget.thousehold_member m WHERE m.household_id=tasset_entry.household_id
 AND m.user_id=auth.uid() AND m.status='active' AND m.deleted_at IS NULL
));

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
 INSERT INTO budget.tasset_entry(position_id,household_id,account_id,auxiliar_id,side,amount_usd,created_by)
 VALUES(v_position,p_household_id,v_account,v_aux,'debit',v_value,auth.uid()),
       (v_position,p_household_id,v_equity,v_aux,'credit',v_value,auth.uid());
 RETURN v_position;
END;
$$;
CREATE OR REPLACE FUNCTION public.f_remove_household_asset(p_position_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE v_household UUID;
BEGIN
 SELECT household_id INTO STRICT v_household FROM budget.tasset_position WHERE id=p_position_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM budget.thousehold_member WHERE household_id=v_household AND user_id=auth.uid()
 AND role='admin' AND status='active' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Only an administrator can remove assets'; END IF;
 UPDATE budget.tasset_position SET status='inactive',deleted_at=now(),deleted_by=auth.uid() WHERE id=p_position_id;
 UPDATE budget.tasset_entry SET status='voided' WHERE position_id=p_position_id;
END;
$$;
REVOKE ALL ON FUNCTION public.f_register_household_asset(UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.f_remove_household_asset(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_register_household_asset(UUID,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_remove_household_asset(UUID) TO authenticated;
NOTIFY pgrst,'reload schema';
