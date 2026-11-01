-- Manually entered bonds may have no listed ticker; preserve unit quantities.
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
 WHEN v_type.unit_kind='security' THEN COALESCE(NULLIF(p_symbol,''),'UNIT') ELSE 'UNIT' END);
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





NOTIFY pgrst,'reload schema';
