-- Reuse the existing pyramid/category model; global templates are copied per home.
ALTER TABLE budget.tfinancial_pyramid
 ADD COLUMN selectable_template BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN source_template_id UUID REFERENCES budget.tfinancial_pyramid(id),
 ADD CONSTRAINT pyramid_household_identity UNIQUE(household_id,id);
ALTER TABLE budget.tfinancial_pyramid_level ADD COLUMN description TEXT,
 ADD COLUMN color CHAR(7) NOT NULL DEFAULT '#5797BA';
ALTER TABLE budget.thousehold ADD COLUMN financial_pyramid_id UUID,
 ADD CONSTRAINT household_selected_pyramid FOREIGN KEY(id,financial_pyramid_id)
 REFERENCES budget.tfinancial_pyramid(household_id,id);
UPDATE budget.tfinancial_pyramid SET selectable_template=true WHERE household_id IS NULL AND code='basic';
UPDATE budget.tfinancial_pyramid_level l SET description=v.description,color=v.color
FROM (VALUES
 ('1','Vivienda, alimentación, transporte y servicios esenciales.','#D47B67'),
 ('2','Salud, seguros, educación, deudas y ahorro para imprevistos.','#DBA35C'),
 ('3','Restaurantes, ropa, mascotas y comodidad cotidiana.','#6DA99F'),
 ('4','Viajes, actividades y experiencias que disfrutan juntos.','#5797BA'),
 ('5','Gustos especiales y compras que pueden esperar.','#8A86B4')
) v(code,description,color),budget.tfinancial_pyramid p
WHERE p.id=l.financial_pyramid_id AND p.code='basic' AND l.code=v.code;
INSERT INTO budget.tfinancial_pyramid(id,business_type_id,code,name,description,selectable_template)
VALUES('f8505c97-2cac-4184-ad23-72c9d5086b5d','e1d42022-fca8-43f2-a37d-7823372fddb0','balanced_50_30_20','50 / 30 / 20',
 'Necesidades básicas, ocio y gastos personales, ahorro e inversión.',true);
INSERT INTO budget.tfinancial_pyramid_level(id,financial_pyramid_id,code,name,description,order_by,min_percentage,max_percentage,color) VALUES
 ('a0500000-0000-4000-8000-000000000001','f8505c97-2cac-4184-ad23-72c9d5086b5d','needs','Necesidades básicas','Vivienda, alimentación, servicios, transporte, salud y obligaciones esenciales.',1,50,50,'#D47B67'),
 ('a0500000-0000-4000-8000-000000000002','f8505c97-2cac-4184-ad23-72c9d5086b5d','personal','Ocio y gastos personales','Salidas, restaurantes, entretenimiento y gustos personales.',2,30,30,'#DBA35C'),
 ('a0500000-0000-4000-8000-000000000003','f8505c97-2cac-4184-ad23-72c9d5086b5d','saving','Ahorro e inversión','Reserva para imprevistos, metas futuras y aportes a inversiones.',3,20,20,'#5797BA');
INSERT INTO budget.tbudget_type_pyramid_level(financial_pyramid_level_id,budget_type_id)
SELECT CASE WHEN category_key='savings_investments' THEN 'a0500000-0000-4000-8000-000000000003'::uuid
 WHEN category_key IN ('restaurants_leisure','clothing_personal_care','pets','other') THEN 'a0500000-0000-4000-8000-000000000002'::uuid
 ELSE 'a0500000-0000-4000-8000-000000000001'::uuid END,id
FROM budget.tbudget_type WHERE household_id IS NULL AND business_type_id='e1d42022-fca8-43f2-a37d-7823372fddb0';

DROP POLICY authenticated_full_access_tfinancial_pyramid ON budget.tfinancial_pyramid;
DROP POLICY authenticated_full_access_tfinancial_pyramid_level ON budget.tfinancial_pyramid_level;
DROP POLICY authenticated_full_access_tbudget_type_pyramid_level ON budget.tbudget_type_pyramid_level;
CREATE POLICY pyramids_read ON budget.tfinancial_pyramid FOR SELECT TO authenticated
 USING(household_id IS NULL OR budget.f_is_household_member(household_id));
CREATE POLICY pyramids_manage ON budget.tfinancial_pyramid FOR ALL TO authenticated
 USING(budget.f_is_household_member(household_id,true)) WITH CHECK(budget.f_is_household_member(household_id,true) AND NOT selectable_template);
CREATE POLICY pyramid_levels_read ON budget.tfinancial_pyramid_level FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM budget.tfinancial_pyramid p WHERE p.id=financial_pyramid_id AND (p.household_id IS NULL OR budget.f_is_household_member(p.household_id))));
CREATE POLICY pyramid_levels_manage ON budget.tfinancial_pyramid_level FOR ALL TO authenticated USING(EXISTS(
 SELECT 1 FROM budget.tfinancial_pyramid p WHERE p.id=financial_pyramid_id AND budget.f_is_household_member(p.household_id,true))) WITH CHECK(EXISTS(
 SELECT 1 FROM budget.tfinancial_pyramid p WHERE p.id=financial_pyramid_id AND budget.f_is_household_member(p.household_id,true)));
CREATE POLICY pyramid_categories_read ON budget.tbudget_type_pyramid_level FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM budget.tfinancial_pyramid_level l JOIN budget.tfinancial_pyramid p ON p.id=l.financial_pyramid_id
 WHERE l.id=financial_pyramid_level_id AND (p.household_id IS NULL OR budget.f_is_household_member(p.household_id))));
CREATE POLICY pyramid_categories_manage ON budget.tbudget_type_pyramid_level FOR ALL TO authenticated USING(EXISTS(
 SELECT 1 FROM budget.tfinancial_pyramid_level l JOIN budget.tfinancial_pyramid p ON p.id=l.financial_pyramid_id
 WHERE l.id=financial_pyramid_level_id AND budget.f_is_household_member(p.household_id,true))) WITH CHECK(EXISTS(
 SELECT 1 FROM budget.tfinancial_pyramid_level l JOIN budget.tfinancial_pyramid p ON p.id=l.financial_pyramid_id
 JOIN budget.tbudget_type b ON b.id=budget_type_id AND b.household_id=p.household_id
 WHERE l.id=financial_pyramid_level_id AND budget.f_is_household_member(p.household_id,true)));

CREATE FUNCTION public.f_select_household_pyramid(p_household_id UUID,p_template_id UUID,p_percentages JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; t budget.tfinancial_pyramid; l budget.tfinancial_pyramid_level;
 target UUID; level_id UUID; percentage NUMERIC; total NUMERIC:=0; input_count INT; expected INT;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id,true) THEN RAISE EXCEPTION 'Only a household administrator can select a pyramid'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL FOR UPDATE;
 SELECT * INTO STRICT t FROM budget.tfinancial_pyramid WHERE id=p_template_id AND household_id IS NULL
 AND selectable_template AND status='active' AND deleted_at IS NULL AND business_type_id=h.business_type_id;
 IF p_percentages IS NULL OR jsonb_typeof(p_percentages)<>'object' THEN RAISE EXCEPTION 'Percentages must be an object'; END IF;
 SELECT count(*) INTO expected FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=t.id AND status='active' AND deleted_at IS NULL;
 SELECT count(*) INTO input_count FROM jsonb_object_keys(p_percentages);
 IF expected<2 OR expected<>input_count THEN RAISE EXCEPTION 'Specify exactly the template levels'; END IF;
 FOR l IN SELECT * FROM budget.tfinancial_pyramid_level WHERE financial_pyramid_id=t.id AND status='active' AND deleted_at IS NULL LOOP
  IF NOT p_percentages ? l.code OR jsonb_typeof(p_percentages->l.code)<>'number' THEN RAISE EXCEPTION 'Invalid level percentage'; END IF;
  percentage:=(p_percentages->>l.code)::numeric;
  IF NOT(percentage>=0 AND percentage<=100) OR percentage<>round(percentage,2) THEN RAISE EXCEPTION 'Percentages must be between 0 and 100 with at most two decimals'; END IF;
  total:=total+percentage;
 END LOOP;
 IF total<>100 THEN RAISE EXCEPTION 'Percentages must total exactly 100'; END IF;
 SELECT id INTO target FROM budget.tfinancial_pyramid WHERE household_id=h.id AND code=t.code
 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1;
 IF target IS NULL THEN
  INSERT INTO budget.tfinancial_pyramid(household_id,code,name,description,source_template_id,created_by)
  VALUES(h.id,t.code,t.name,t.description,t.id,auth.uid()) RETURNING id INTO target;
 ELSE
  UPDATE budget.tfinancial_pyramid SET source_template_id=t.id,updated_at=now(),updated_by=auth.uid(),status='active' WHERE id=target;
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
REVOKE ALL ON FUNCTION public.f_select_household_pyramid(UUID,UUID,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_select_household_pyramid(UUID,UUID,JSONB) TO authenticated;
NOTIFY pgrst,'reload schema';
