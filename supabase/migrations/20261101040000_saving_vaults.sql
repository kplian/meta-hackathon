-- Vaults are native-currency asset accounts + auxiliars. No position, shadow
-- balance or vault movement table: every balance comes from the common journal.
INSERT INTO budget.tauxiliar_type(code,name) VALUES('vault','Bóveda de ahorro') ON CONFLICT(code) DO NOTHING;
ALTER TABLE budget.tauxiliar
 ADD COLUMN vault_account_id UUID REFERENCES budget.taccount(id),
 ADD COLUMN vault_goal_amount NUMERIC(30,8) CHECK(vault_goal_amount>0 AND vault_goal_amount<1e22),
 ADD COLUMN vault_creation_request_id UUID UNIQUE;
ALTER TABLE budget.ttransaction
 ADD COLUMN vault_request_id UUID,
 ADD COLUMN vault_leg SMALLINT,
 ADD COLUMN household_currency_at_posting CHAR(3),
 ADD COLUMN household_fx_rate NUMERIC(30,10),
 ADD CONSTRAINT vault_request_leg CHECK((vault_request_id IS NULL AND vault_leg IS NULL) OR (vault_request_id IS NOT NULL AND vault_leg IS NOT NULL AND vault_leg IN (1,2))),
 ADD CONSTRAINT journal_household_fx CHECK((household_currency_at_posting IS NULL AND household_fx_rate IS NULL) OR
 (household_currency_at_posting IS NOT NULL AND household_fx_rate IS NOT NULL AND household_fx_rate>0 AND household_fx_rate<1e18)),
 ADD CONSTRAINT vault_request_unique UNIQUE(vault_request_id,vault_leg);
CREATE INDEX journal_account_auxiliar ON budget.ttransaction_detail(account_id,auxiliar_id);
CREATE INDEX vault_history_household ON budget.ttransaction(household_id,created_at DESC) WHERE vault_request_id IS NOT NULL AND vault_leg=1;
COMMENT ON COLUMN budget.ttransaction.household_fx_rate IS 'Household currency units per one journal currency unit, fixed at posting. Native debit/credit amounts remain in ttransaction.currency.';
COMMENT ON COLUMN budget.tauxiliar.vault_account_id IS 'Vault identity and native currency are fixed by this account. Balance is the journal debit minus credit for account + auxiliar.';

CREATE POLICY vault_auxiliar_isolation ON budget.tauxiliar AS RESTRICTIVE FOR ALL TO authenticated
 USING(vault_account_id IS NULL OR budget.f_is_household_member(household_id))
 WITH CHECK(vault_account_id IS NULL OR budget.f_is_household_member(household_id,true));
CREATE POLICY vault_account_isolation ON budget.taccount AS RESTRICTIVE FOR ALL TO authenticated
 USING(code NOT LIKE 'VAULT-%' OR budget.f_is_household_member(household_id))
 WITH CHECK(code NOT LIKE 'VAULT-%' OR budget.f_is_household_member(household_id,true));

CREATE FUNCTION budget.f_vault_balance(p_auxiliar UUID) RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
 SELECT COALESCE(sum(d.debit_base-d.credit_base),0) FROM budget.tauxiliar x
 JOIN budget.taccount a ON a.id=x.vault_account_id JOIN budget.ttransaction_detail d ON d.account_id=a.id AND d.auxiliar_id=x.id
 JOIN budget.ttransaction t ON t.id=d.transaction_id AND t.household_id=x.household_id
 WHERE x.id=p_auxiliar AND t.ledger_book='operating' AND t.currency=a.currency AND t.transaction_date<=now()
 AND t.status='active' AND t.deleted_at IS NULL AND d.status='active' AND d.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION budget.f_vault_balance(UUID) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION budget.f_check_vault_identity() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE a budget.taccount; h budget.thousehold; code TEXT;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.vault_account_id IS NOT NULL AND auth.uid() IS NOT NULL AND NOT budget.f_is_household_member(OLD.household_id,true) THEN RAISE EXCEPTION 'Only a household administrator can manage vaults'; END IF;
  IF OLD.vault_account_id IS NOT NULL AND EXISTS(SELECT 1 FROM budget.ttransaction_detail WHERE auxiliar_id=OLD.id) THEN RAISE EXCEPTION 'Vault history cannot be deleted'; END IF;
  RETURN OLD;
 END IF;
 SELECT t.code INTO STRICT code FROM budget.tauxiliar_type t WHERE t.id=NEW.auxiliar_type_id;
 IF (code='vault') IS DISTINCT FROM (NEW.vault_account_id IS NOT NULL) THEN RAISE EXCEPTION 'A vault must have a fixed native currency account'; END IF;
 IF TG_OP='UPDATE' AND OLD.vault_account_id IS NOT NULL THEN
  IF NEW.household_id<>OLD.household_id OR NEW.vault_account_id IS DISTINCT FROM OLD.vault_account_id OR NEW.auxiliar_type_id<>OLD.auxiliar_type_id
  OR NEW.vault_creation_request_id IS DISTINCT FROM OLD.vault_creation_request_id THEN RAISE EXCEPTION 'Vault account, household and currency are immutable'; END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) AND budget.f_vault_balance(OLD.id)<>0 THEN RAISE EXCEPTION 'Empty a vault before archiving it'; END IF;
 END IF;
 IF NEW.vault_account_id IS NOT NULL THEN
  IF auth.uid() IS NOT NULL AND NOT budget.f_is_household_member(NEW.household_id,true) THEN RAISE EXCEPTION 'Only a household administrator can manage vaults'; END IF;
  SELECT * INTO STRICT h FROM budget.thousehold WHERE id=NEW.household_id;
  SELECT * INTO STRICT a FROM budget.taccount WHERE id=NEW.vault_account_id;
  IF a.household_id IS DISTINCT FROM h.id OR a.currency NOT IN(h.currency,'USD') OR a.code<>'VAULT-'||trim(a.currency)
  OR a.required_auxiliar_type_id IS DISTINCT FROM NEW.auxiliar_type_id OR NOT a.requires_auxiliar OR NOT a.is_postable OR a.status<>'active' OR a.deleted_at IS NOT NULL
  THEN RAISE EXCEPTION 'Invalid vault account'; END IF;
 ELSIF NEW.vault_goal_amount IS NOT NULL OR NEW.vault_creation_request_id IS NOT NULL THEN RAISE EXCEPTION 'Vault metadata requires a vault account'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vault_identity BEFORE INSERT OR UPDATE OR DELETE ON budget.tauxiliar FOR EACH ROW EXECUTE FUNCTION budget.f_check_vault_identity();
REVOKE ALL ON FUNCTION budget.f_check_vault_identity() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION budget.f_protect_vault_account() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM budget.tauxiliar WHERE vault_account_id=OLD.id) AND
 (NEW.currency IS DISTINCT FROM OLD.currency OR NEW.code<>OLD.code OR NEW.household_id IS DISTINCT FROM OLD.household_id
 OR NEW.account_type_id<>OLD.account_type_id OR NEW.required_auxiliar_type_id IS DISTINCT FROM OLD.required_auxiliar_type_id
 OR NOT NEW.requires_auxiliar OR NOT NEW.is_postable OR NEW.status IS DISTINCT FROM OLD.status OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
 THEN RAISE EXCEPTION 'A vault account identity cannot be changed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vault_account_identity BEFORE UPDATE ON budget.taccount FOR EACH ROW EXECUTE FUNCTION budget.f_protect_vault_account();
REVOKE ALL ON FUNCTION budget.f_protect_vault_account() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION budget.f_vault_line_identity() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE x budget.tauxiliar; t budget.ttransaction; a budget.taccount;
BEGIN
 SELECT * INTO STRICT x FROM budget.tauxiliar WHERE id=NEW.auxiliar_id;
 SELECT * INTO STRICT a FROM budget.taccount WHERE id=NEW.account_id;
 IF x.vault_account_id IS NOT NULL OR a.code ~ '^VAULT-[A-Z]{3}$' THEN
  SELECT * INTO STRICT t FROM budget.ttransaction WHERE id=NEW.transaction_id;
  IF x.vault_account_id IS DISTINCT FROM a.id OR t.ledger_book<>'operating' OR t.currency<>a.currency
  OR t.household_id IS DISTINCT FROM x.household_id OR x.status<>'active' OR x.deleted_at IS NOT NULL
  THEN RAISE EXCEPTION 'Vault lines must match their fixed account, household and native currency'; END IF;
  PERFORM 1 FROM budget.thousehold WHERE id=t.household_id FOR UPDATE;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vault_line_identity BEFORE INSERT OR UPDATE ON budget.ttransaction_detail FOR EACH ROW EXECUTE FUNCTION budget.f_vault_line_identity();
REVOKE ALL ON FUNCTION budget.f_vault_line_identity() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.f_create_saving_vault(p_household_id UUID,p_request_id UUID,p_name TEXT,p_currency TEXT,p_goal NUMERIC DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; old budget.tauxiliar; a UUID; aux_type UUID; asset_type UUID; result UUID;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id,true) THEN RAISE EXCEPTION 'Only a household administrator can create vaults'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL FOR UPDATE;
 IF p_request_id IS NULL OR NULLIF(trim(p_name),'') IS NULL OR length(trim(p_name))>100 OR p_currency IS NULL OR p_currency NOT IN(trim(h.currency),'USD')
 OR (p_goal IS NOT NULL AND NOT(round(p_goal,8)>0 AND p_goal<1e22)) THEN RAISE EXCEPTION 'Invalid vault name, currency or goal'; END IF;
 SELECT * INTO old FROM budget.tauxiliar WHERE vault_creation_request_id=p_request_id;
 IF FOUND THEN
  IF old.household_id<>h.id OR old.name<>trim(p_name) OR old.vault_goal_amount IS DISTINCT FROM round(p_goal,8)
   OR NOT EXISTS(SELECT 1 FROM budget.taccount WHERE id=old.vault_account_id AND currency=p_currency) THEN RAISE EXCEPTION 'Request ID already used with different vault data'; END IF;
  RETURN old.id;
 END IF;
 SELECT id INTO STRICT aux_type FROM budget.tauxiliar_type WHERE code='vault';
 SELECT id INTO STRICT asset_type FROM budget.taccount_type WHERE code='asset';
 INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency,requires_auxiliar,required_auxiliar_type_id,created_by)
 VALUES(h.id,asset_type,'VAULT-'||p_currency,'Bóvedas en '||p_currency,p_currency,true,aux_type,auth.uid()) ON CONFLICT(household_id,code) DO NOTHING;
 SELECT id INTO STRICT a FROM budget.taccount WHERE household_id=h.id AND code='VAULT-'||p_currency;
 INSERT INTO budget.tauxiliar(household_id,auxiliar_type_id,code,name,vault_account_id,vault_goal_amount,vault_creation_request_id,created_by)
 VALUES(h.id,aux_type,'VAULT-'||p_request_id,trim(p_name),a,p_goal,p_request_id,auth.uid()) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_create_saving_vault(UUID,UUID,TEXT,TEXT,NUMERIC) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_create_saving_vault(UUID,UUID,TEXT,TEXT,NUMERIC) TO authenticated;

CREATE FUNCTION public.f_saving_vaults(p_household_id UUID) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE result JSONB;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 WITH vaults AS(SELECT x.id,x.name,x.vault_account_id account_id,x.vault_goal_amount goal,trim(a.currency) currency,budget.f_vault_balance(x.id) balance
 FROM budget.tauxiliar x JOIN budget.taccount a ON a.id=x.vault_account_id
 WHERE x.household_id=p_household_id AND x.status='active' AND x.deleted_at IS NULL AND a.status='active' AND a.deleted_at IS NULL)
 SELECT jsonb_build_object('vaults',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.name,v.id) FROM vaults v),'[]'::jsonb),
 'totals',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.currency) FROM(SELECT currency,sum(balance) balance FROM vaults GROUP BY currency)t),'[]'::jsonb),
 'history',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM(
 SELECT t.vault_request_id id,t.created_at,t.input_data->'vault_movement' movement FROM budget.ttransaction t
 WHERE t.household_id=p_household_id AND t.vault_request_id IS NOT NULL AND t.vault_leg=1 AND t.status='active' AND t.deleted_at IS NULL
 ORDER BY t.created_at DESC,t.id LIMIT 30)t),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_saving_vaults(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_saving_vaults(UUID) TO authenticated;

CREATE FUNCTION public.f_transfer_saving_vault(p_household_id UUID,p_request_id UUID,p_source JSONB,p_destination JSONB,p_source_amount NUMERIC,p_destination_amount NUMERIC,
 p_household_per_usd NUMERIC DEFAULT NULL,p_note TEXT DEFAULT NULL,p_rate_as_of TIMESTAMPTZ DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; sx budget.tauxiliar; dx budget.tauxiliar; sa budget.taccount; da budget.taccount; old budget.ttransaction;
 sq NUMERIC:=round(p_source_amount,8); dq NUMERIC:=round(p_destination_amount,8); rate NUMERIC:=round(p_household_per_usd,10);
 native NUMERIC; dollars NUMERIC; payload JSONB; movement JSONB; same_currency BOOLEAN; general UUID; aux_type UUID; asset_type UUID; bridge UUID; tx UUID; leg INT;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id,true) THEN RAISE EXCEPTION 'Only a household administrator can move vault funds'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL FOR UPDATE;
 payload:=jsonb_build_object('source',p_source,'destination',p_destination,'source_amount',sq,'destination_amount',dq,'household_per_usd',rate,'note',NULLIF(trim(p_note),''),'rate_as_of',p_rate_as_of);
 SELECT * INTO old FROM budget.ttransaction WHERE vault_request_id=p_request_id AND vault_leg=1;
 IF FOUND THEN
  IF old.household_id<>h.id OR old.input_data->'vault_payload' IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Request ID already used with different vault movement'; END IF;
  RETURN p_request_id;
 END IF;
 IF p_request_id IS NULL OR sq IS NULL OR dq IS NULL OR NOT(sq>0 AND sq<1e22) OR NOT(dq>0 AND dq<1e22) OR length(p_note)>200
 OR p_source->>'kind' IS NULL OR p_source->>'kind' NOT IN('operating','vault') OR p_destination->>'kind' IS NULL OR p_destination->>'kind' NOT IN('operating','vault')
 OR (p_source->>'kind'='operating' AND p_destination->>'kind'='operating') OR p_rate_as_of>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid vault movement'; END IF;
 IF p_source->>'kind'='vault' THEN
  SELECT * INTO STRICT sx FROM budget.tauxiliar WHERE id=(p_source->>'id')::uuid AND household_id=h.id AND vault_account_id IS NOT NULL AND status='active' AND deleted_at IS NULL FOR UPDATE;
  SELECT * INTO STRICT sa FROM budget.taccount WHERE id=sx.vault_account_id AND status='active' AND deleted_at IS NULL;
  IF budget.f_vault_balance(sx.id)<sq THEN RAISE EXCEPTION 'Insufficient vault balance'; END IF;
 ELSE
  SELECT * INTO STRICT sa FROM budget.taccount WHERE id=(p_source->>'id')::uuid AND household_id=h.id AND code IN('110','111','112') AND currency=h.currency AND status='active' AND deleted_at IS NULL AND is_postable;
  IF budget.f_operating_available(h.id,sa.id)<sq THEN RAISE EXCEPTION 'Insufficient available money'; END IF;
 END IF;
 IF p_destination->>'kind'='vault' THEN
  SELECT * INTO STRICT dx FROM budget.tauxiliar WHERE id=(p_destination->>'id')::uuid AND household_id=h.id AND vault_account_id IS NOT NULL AND status='active' AND deleted_at IS NULL FOR UPDATE;
  SELECT * INTO STRICT da FROM budget.taccount WHERE id=dx.vault_account_id AND status='active' AND deleted_at IS NULL;
 ELSE
  SELECT * INTO STRICT da FROM budget.taccount WHERE id=(p_destination->>'id')::uuid AND household_id=h.id AND code IN('110','111','112') AND currency=h.currency AND status='active' AND deleted_at IS NULL AND is_postable;
 END IF;
 IF sx.id=dx.id OR sa.currency NOT IN(h.currency,'USD') OR da.currency NOT IN(h.currency,'USD') THEN RAISE EXCEPTION 'Choose different endpoints in household currency or USD'; END IF;
 same_currency:=sa.currency=da.currency;
 IF same_currency THEN
  IF sq<>dq THEN RAISE EXCEPTION 'Same currency transfers must preserve amount'; END IF;
  rate:=NULL;
 ELSE
  native:=CASE WHEN sa.currency=h.currency THEN sq ELSE dq END;
  dollars:=CASE WHEN sa.currency='USD' THEN sq ELSE dq END;
  IF rate IS NULL OR NOT(rate>0 AND rate<1e18) OR abs(native-dollars*rate)>greatest(0.00000001,rate*0.000000005+0.00000001)
  THEN RAISE EXCEPTION 'Exchange rate does not match the transferred amounts'; END IF;
 END IF;
 SELECT id INTO STRICT aux_type FROM budget.tauxiliar_type WHERE code='asset';
 SELECT id INTO STRICT asset_type FROM budget.taccount_type WHERE code='asset';
 INSERT INTO budget.tauxiliar(household_id,auxiliar_type_id,code,name,created_by) VALUES(h.id,aux_type,'VAULT-TRANSFERS','Movimientos de bóvedas',auth.uid()) ON CONFLICT(household_id,code) DO NOTHING;
 SELECT id INTO STRICT general FROM budget.tauxiliar WHERE household_id=h.id AND code='VAULT-TRANSFERS' AND status='active' AND deleted_at IS NULL;
 movement:=jsonb_build_object('source_name',COALESCE(sx.name,sa.name),'destination_name',COALESCE(dx.name,da.name),'source_amount',sq,'destination_amount',dq,
 'source_currency',trim(sa.currency),'destination_currency',trim(da.currency),'household_per_usd',rate,'rate_as_of',p_rate_as_of);
 FOR leg IN 1..(CASE WHEN same_currency THEN 1 ELSE 2 END) LOOP
  IF NOT same_currency THEN
   INSERT INTO budget.taccount(household_id,account_type_id,code,name,currency,created_by)
    VALUES(h.id,asset_type,'VAULT-FX-'||trim(CASE WHEN leg=1 THEN sa.currency ELSE da.currency END),'Enlace de cambio de bóvedas',CASE WHEN leg=1 THEN sa.currency ELSE da.currency END,auth.uid()) ON CONFLICT(household_id,code) DO NOTHING;
   SELECT id INTO STRICT bridge FROM budget.taccount WHERE household_id=h.id AND code='VAULT-FX-'||trim(CASE WHEN leg=1 THEN sa.currency ELSE da.currency END) AND status='active' AND deleted_at IS NULL;
  END IF;
  INSERT INTO budget.ttransaction(household_id,type,amount,currency,ledger_book,concept,recorded_via,created_by,vault_request_id,vault_leg,household_currency_at_posting,household_fx_rate,input_data)
   VALUES(h.id,'transfer',CASE WHEN leg=1 THEN sq ELSE dq END,CASE WHEN leg=1 THEN sa.currency ELSE da.currency END,'operating',COALESCE(NULLIF(trim(p_note),''),'Movimiento entre disponible y bóvedas'),'vaults',auth.uid(),p_request_id,leg,
   CASE WHEN same_currency AND sa.currency<>h.currency THEN NULL ELSE h.currency END,
   CASE WHEN (CASE WHEN leg=1 THEN sa.currency ELSE da.currency END)=h.currency THEN 1 WHEN NOT same_currency THEN rate END,
   jsonb_build_object('vault_payload',payload,'vault_movement',movement)) RETURNING id INTO tx;
  IF same_currency THEN
   INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,created_by) VALUES
   (tx,da.id,COALESCE(dx.id,general),'Entrada a destino',dq,0,auth.uid()),(tx,sa.id,COALESCE(sx.id,general),'Salida de origen',0,sq,auth.uid());
  ELSIF leg=1 THEN
   INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,created_by) VALUES
   (tx,bridge,general,'Contrapartida de cambio',sq,0,auth.uid()),(tx,sa.id,COALESCE(sx.id,general),'Salida de origen',0,sq,auth.uid());
  ELSE
   INSERT INTO budget.ttransaction_detail(transaction_id,account_id,auxiliar_id,description,debit_base,credit_base,created_by) VALUES
   (tx,da.id,COALESCE(dx.id,general),'Entrada a destino',dq,0,auth.uid()),(tx,bridge,general,'Contrapartida de cambio',0,dq,auth.uid());
  END IF;
  PERFORM budget.f_check_journal(tx);
 END LOOP;
 RETURN p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.f_transfer_saving_vault(UUID,UUID,JSONB,JSONB,NUMERIC,NUMERIC,NUMERIC,TEXT,TIMESTAMPTZ) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_transfer_saving_vault(UUID,UUID,JSONB,JSONB,NUMERIC,NUMERIC,NUMERIC,TEXT,TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION budget.f_protect_patrimony_journal() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=budget,public AS $$
DECLARE t budget.ttransaction;
BEGIN
 IF TG_TABLE_NAME='ttransaction' THEN t:=OLD; ELSE SELECT * INTO t FROM budget.ttransaction WHERE id=OLD.transaction_id; END IF;
 IF t.ledger_book='patrimony' OR t.input_data ? 'investment_movement_id' OR t.vault_request_id IS NOT NULL THEN RAISE EXCEPTION 'Posted financial movements are immutable; use a reversing entry'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
NOTIFY pgrst,'reload schema';
