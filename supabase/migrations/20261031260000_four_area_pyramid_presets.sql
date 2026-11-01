ALTER TABLE budget.tfinancial_pyramid ADD COLUMN customized BOOLEAN NOT NULL DEFAULT false;
-- Preserve earlier household plans while replacing the offered global presets.
UPDATE budget.tfinancial_pyramid SET selectable_template=false WHERE household_id IS NULL AND code IN ('basic','balanced_50_30_20');
INSERT INTO budget.tfinancial_pyramid(id,business_type_id,code,name,description,selectable_template) VALUES
 ('f8505c97-2cac-4184-ad23-72c9d5086e01','e1d42022-fca8-43f2-a37d-7823372fddb0','essential','Pirámide esencial','60% necesidades · 20% deudas · 10% ocio · 10% ahorro.',true),
 ('f8505c97-2cac-4184-ad23-72c9d5086e02','e1d42022-fca8-43f2-a37d-7823372fddb0','balanced','Pirámide equilibrada','50% necesidades · 15% deudas · 15% ocio · 20% ahorro.',true),
 ('f8505c97-2cac-4184-ad23-72c9d5086e03','e1d42022-fca8-43f2-a37d-7823372fddb0','wealth','Pirámide patrimonial','40% necesidades · 10% deudas · 10% ocio · 40% ahorro.',true);
INSERT INTO budget.tfinancial_pyramid_level(financial_pyramid_id,code,name,description,order_by,min_percentage,max_percentage,color)
SELECT p.id,l.code,l.name,l.description,l.ord,
 CASE p.code WHEN 'essential' THEN l.essential WHEN 'balanced' THEN l.balanced ELSE l.wealth END,
 CASE p.code WHEN 'essential' THEN l.essential WHEN 'balanced' THEN l.balanced ELSE l.wealth END,l.color
FROM budget.tfinancial_pyramid p CROSS JOIN (VALUES
 ('needs','Necesidades básicas','Vivienda, alimentación, transporte y servicios esenciales.',1,60,50,40,'#D47B67'),
 ('debts','Deudas y compromisos','Cuotas de préstamos, seguros y obligaciones periódicas.',2,20,15,10,'#DBA35C'),
 ('personal','Ocio y personales','Salidas, entretenimiento y gustos personales.',3,10,15,10,'#6DA99F'),
 ('saving','Ahorro e inversiones','Reserva, metas futuras y aportes a inversiones.',4,10,20,40,'#5797BA')
) l(code,name,description,ord,essential,balanced,wealth,color)
WHERE p.household_id IS NULL AND p.code IN ('essential','balanced','wealth');
INSERT INTO budget.tbudget_type_pyramid_level(financial_pyramid_level_id,budget_type_id)
SELECT l.id,b.id FROM budget.tfinancial_pyramid_level l JOIN budget.tfinancial_pyramid p ON p.id=l.financial_pyramid_id
JOIN budget.tbudget_type b ON b.household_id IS NULL AND b.business_type_id=p.business_type_id
WHERE p.household_id IS NULL AND p.code IN ('essential','balanced','wealth') AND l.code=CASE
 WHEN b.category_key='savings_investments' THEN 'saving'
 WHEN b.category_key IN ('debts_loans','taxes_fees','insurance') THEN 'debts'
 WHEN b.category_key IN ('restaurants_leisure','clothing_personal_care','pets','other') THEN 'personal'
 ELSE 'needs' END;

DROP FUNCTION public.f_select_household_pyramid(UUID,UUID,JSONB);
CREATE FUNCTION public.f_select_household_pyramid(p_household_id UUID,p_template_id UUID,p_percentages JSONB,p_customized BOOLEAN DEFAULT false)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; t budget.tfinancial_pyramid; l budget.tfinancial_pyramid_level;
 target UUID; level_id UUID; percentage NUMERIC; total NUMERIC:=0; input_count INT; expected INT;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id,true) THEN RAISE EXCEPTION 'Only a household administrator can select a pyramid'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL FOR UPDATE;
 SELECT * INTO STRICT t FROM budget.tfinancial_pyramid WHERE id=p_template_id AND household_id IS NULL
 AND selectable_template AND status='active' AND deleted_at IS NULL AND business_type_id=h.business_type_id;
 IF p_customized IS NULL THEN RAISE EXCEPTION 'Specify preset or custom mode'; END IF;
 IF p_percentages IS NULL OR jsonb_typeof(p_percentages)<>'object' THEN RAISE EXCEPTION 'Percentages must be an object'; END IF;
 SELECT count(*) INTO expected FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=t.id AND status='active' AND deleted_at IS NULL;
 SELECT count(*) INTO input_count FROM jsonb_object_keys(p_percentages);
 IF expected<2 OR expected<>input_count THEN RAISE EXCEPTION 'Specify exactly the template levels'; END IF;
 FOR l IN SELECT * FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=t.id AND status='active' AND deleted_at IS NULL LOOP
  IF NOT p_percentages ? l.code OR jsonb_typeof(p_percentages->l.code)<>'number' THEN RAISE EXCEPTION 'Invalid level percentage'; END IF;
  percentage:=(p_percentages->>l.code)::numeric;
  IF NOT(percentage>=0 AND percentage<=100) OR percentage<>round(percentage,2) THEN RAISE EXCEPTION 'Percentages must be between 0 and 100 with at most two decimals'; END IF;
  IF NOT p_customized AND percentage<>l.min_percentage THEN RAISE EXCEPTION 'Preset percentages must remain unchanged; choose custom mode to edit'; END IF;
  total:=total+percentage;
 END LOOP;
 IF total<>100 THEN RAISE EXCEPTION 'Percentages must total exactly 100'; END IF;
 SELECT id INTO target FROM budget.tfinancial_pyramid WHERE household_id=h.id AND code=t.code
 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1;
 IF target IS NULL THEN
  INSERT INTO budget.tfinancial_pyramid(household_id,code,name,description,source_template_id,customized,created_by)
  VALUES(h.id,t.code,t.name,t.description,t.id,p_customized,auth.uid()) RETURNING id INTO target;
 ELSE
  UPDATE budget.tfinancial_pyramid SET source_template_id=t.id,customized=p_customized,updated_at=now(),updated_by=auth.uid(),status='active' WHERE id=target;
 END IF;
 -- Replace only this household copy. Global templates and category budgets stay intact.
 DELETE FROM budget.tbudget_type_pyramid_level WHERE financial_pyramid_level_id IN(SELECT id FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=target);
 DELETE FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=target;
 FOR l IN SELECT * FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=t.id AND status='active' AND deleted_at IS NULL ORDER BY order_by LOOP
  percentage:=(p_percentages->>l.code)::numeric;
  INSERT INTO budget.tfinancial_pyramid_level(financial_pyramid_id,code,name,description,color,order_by,min_percentage,max_percentage,created_by)
  VALUES(target,l.code,l.name,l.description,l.color,l.order_by,percentage,percentage,auth.uid()) RETURNING id INTO level_id;
  INSERT INTO budget.tbudget_type_pyramid_level(financial_pyramid_level_id,budget_type_id,created_by)
  SELECT DISTINCT level_id,owned.id,auth.uid()
  FROM budget.tbudget_type_pyramid_level m JOIN budget.tbudget_type original ON original.id=m.budget_type_id
  JOIN budget.tbudget_type owned ON owned.household_id=h.id AND owned.category_key=original.category_key AND owned.status='active' AND owned.deleted_at IS NULL
  WHERE m.financial_pyramid_level_id=l.id AND m.status='active' AND m.deleted_at IS NULL;
 END LOOP;
 UPDATE budget.thousehold SET financial_pyramid_id=target,updated_at=now(),updated_by=auth.uid() WHERE id=h.id;
 RETURN target;
END; $$;

REVOKE ALL ON FUNCTION public.f_select_household_pyramid(UUID,UUID,JSONB,BOOLEAN) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_select_household_pyramid(UUID,UUID,JSONB,BOOLEAN) TO authenticated;
NOTIFY pgrst,'reload schema';
