-- Health catalog: allergens, diets, conditions, activities, goals, activity levels.
-- Labels live here (app, Edge Function prompt and WhatsApp agent read them).
-- keywords/exclusions are normalized (lowercase, no accents, [a-z0-9 ]) at the end.
CREATE OR REPLACE FUNCTION budget.f_norm_text(p TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(regexp_replace(translate(lower(COALESCE(p, '')),
    'áéíóúàèìòùâêîôûãõäëïöüçñ', 'aeiouaeiouaeiouaoaeioucn'), '[^a-z0-9]+', ' ', 'g'), ' +', ' ', 'g'));
$$;

CREATE TABLE budget.thealth_option (
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('allergen', 'diet', 'condition', 'activity', 'goal', 'activity_level')),
    code VARCHAR(40) NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    icon VARCHAR(50) NOT NULL,
    sort_order INTEGER NOT NULL,
    labels JSONB NOT NULL,                  -- {"es": "...", "en": "...", "pt": "..."}
    hard BOOLEAN NOT NULL DEFAULT false,    -- its keywords may never appear in a plan of the household
    implies_allergen VARCHAR(40),           -- celiac / gluten_free -> 'gluten'
    keywords TEXT[] NOT NULL DEFAULT '{}',
    exclusions TEXT[] NOT NULL DEFAULT '{}',-- phrases removed from the text before matching keywords
    prompt_rule TEXT,                       -- English instruction for the meal planner
    CONSTRAINT thealth_option_pkey PRIMARY KEY (kind, code),
    CONSTRAINT thealth_option_labels_check CHECK (labels ? 'es' AND labels ? 'en' AND labels ? 'pt')
);
ALTER TABLE budget.thealth_option ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON budget.thealth_option FROM anon;
GRANT SELECT ON budget.thealth_option TO authenticated;
GRANT ALL ON budget.thealth_option TO service_role;
CREATE POLICY health_options_read ON budget.thealth_option FOR SELECT TO authenticated USING (true);

INSERT INTO budget.thealth_option (kind, code, icon, sort_order, labels, hard, implies_allergen, keywords, exclusions, prompt_rule) VALUES
-- 1. Allergens (EU Reg. 1169/2011 Annex II; includes the FDA 9). All hard.
('allergen','gluten','pizza-outline',1,'{"es":"Cereales con gluten","en":"Gluten cereals","pt":"Cereais com glúten"}',true,NULL,
 ARRAY['gluten','trigo','harina de trigo','harina','pan','fideo','pasta','cebada','centeno','avena','sémola','cuscús','malta','cerveza','wheat','flour','bread','noodle','barley','rye','oat','semolina','couscous','spelt','malt','beer','farinha de trigo','farinha','pão','macarrão','massa','cevada','centeio','aveia','malte','cerveja','biscoito'],
 ARRAY['harina de maíz','harina de arroz','harina de yuca','harina de quinua','harina de plátano','chuño','tapioca','trigo sarraceno','fubá','polvilho','cuscuz de milho','sin gluten','gluten free','sem glúten','farinha de arroz','farinha de milho','farinha de mandioca','rice flour','corn flour','cornmeal','buckwheat','oat milk','leche de avena','leite de aveia'],NULL),
('allergen','crustaceans','bug-outline',2,'{"es":"Crustáceos","en":"Crustaceans","pt":"Crustáceos"}',true,NULL,
 ARRAY['camarón','langostino','langosta','cangrejo','jaiba','centolla','gamba','cigala','krill','shrimp','prawn','lobster','crab','crayfish','langoustine','scampi','camarão','lagosta','caranguejo','siri','lagostim','pitu'],'{}',NULL),
('allergen','eggs','egg-outline',3,'{"es":"Huevo","en":"Eggs","pt":"Ovo"}',true,NULL,
 ARRAY['huevo','clara de huevo','yema','mayonesa','merengue','albúmina','flan','egg','egg white','yolk','mayonnaise','meringue','albumin','custard','ovo','clara','gema','maionese','pudim','quindim'],
 ARRAY['eggplant','berenjena','berinjela','tortilla de maíz','mayonesa vegana','vegan mayonnaise','maionese vegana'],NULL),
('allergen','fish','fish-outline',4,'{"es":"Pescado","en":"Fish","pt":"Peixe"}',true,NULL,
 ARRAY['pescado','atún','salmón','trucha','pejerrey','ispi','sardina','bacalao','merluza','surubí','pacú','anchoa','fish','tuna','salmon','trout','sardine','cod','anchovy','tilapia','hake','fish sauce','worcestershire','peixe','atum','salmão','truta','sardinha','bacalhau','tilápia','pescada','anchova','molho de peixe'],'{}',NULL),
('allergen','peanuts','ellipse-outline',5,'{"es":"Maní","en":"Peanuts","pt":"Amendoim"}',true,NULL,
 ARRAY['maní','cacahuate','cacahuete','mantequilla de maní','pasta de maní','sopa de maní','salsa de maní','aceite de maní','turrón de maní','peanut','peanut butter','peanut oil','groundnut','satay','amendoim','pasta de amendoim','paçoca','pé de moleque','óleo de amendoim'],'{}',NULL),
('allergen','soy','cube-outline',6,'{"es":"Soya","en":"Soy","pt":"Soja"}',true,NULL,
 ARRAY['soya','soja','tofu','salsa de soya','leche de soya','carne de soya','proteína de soya','lecitina de soya','edamame','miso','soy','soybean','soy sauce','tempeh','tvp','shoyu','molho de soja','leite de soja','proteína de soja','missô'],
 ARRAY['brotes de soya','aceite de soya','soybean oil','óleo de soja'],NULL),
('allergen','milk','cafe-outline',7,'{"es":"Leche","en":"Milk","pt":"Leite"}',true,NULL,
 ARRAY['leche','queso','quesillo','mantequilla','crema de leche','nata','yogur','yogurt','requesón','suero de leche','leche condensada','dulce de leche','cuñapé','milk','cheese','butter','cream','whey','casein','ghee','buttermilk','condensed milk','ice cream','leite','queijo','manteiga','creme de leite','iogurte','requeijão','soro de leite','leite condensado','doce de leite','pão de queijo'],
 ARRAY['leche de coco','leche de almendra','leche de soya','leche de avena','leche de arroz','mantequilla de maní','manteca de cerdo','manteca de cacao','crémor tártaro','leite de coco','leite de soja','leite de amêndoa','leite de aveia','coconut milk','almond milk','soy milk','oat milk','rice milk','peanut butter','cocoa butter','cream of tartar','coconut cream'],NULL),
('allergen','tree_nuts','nutrition-outline',8,'{"es":"Frutos secos","en":"Tree nuts","pt":"Castanhas e nozes"}',true,NULL,
 ARRAY['nuez','almendra','avellana','castaña','castaña amazónica','castaña de brasil','anacardo','marañón','pistacho','pecana','macadamia','almond','walnut','hazelnut','cashew','pecan','pistachio','brazil nut','praline','marzipan','castanha','castanha do pará','castanha de caju','amêndoa','noz','avelã','pistache','macadâmia','pecã'],
 ARRAY['nuez moscada','nutmeg','noz moscada','castaña de agua','water chestnut'],NULL),
('allergen','celery','leaf-outline',9,'{"es":"Apio","en":"Celery","pt":"Aipo"}',true,NULL,
 ARRAY['apio','apio nabo','sal de apio','semilla de apio','celery','celeriac','celery salt','celery seed','aipo','salsão','aipo rábano','sal de aipo'],'{}',NULL),
('allergen','mustard','flask-outline',10,'{"es":"Mostaza","en":"Mustard","pt":"Mostarda"}',true,NULL,
 ARRAY['mostaza','semilla de mostaza','hoja de mostaza','mustard','dijon','mostarda'],'{}',NULL),
('allergen','sesame','sparkles-outline',11,'{"es":"Sésamo","en":"Sesame","pt":"Gergelim"}',true,NULL,
 ARRAY['sésamo','ajonjolí','tahini','tahína','aceite de sésamo','gomasio','sesame','benne','halva','hummus','gergelim','tahine','óleo de gergelim','homus'],'{}',NULL),
('allergen','sulphites','wine-outline',12,'{"es":"Sulfitos","en":"Sulphites","pt":"Sulfitos"}',true,NULL,
 ARRAY['vino','sulfito','metabisulfito','pasas','orejones','fruta deshidratada','vinagre de vino','wine','sulfite','sulphite','metabisulfite','raisin','dried apricot','vinho','uva passa','damasco seco'],'{}',NULL),
('allergen','lupin','flower-outline',13,'{"es":"Lupino (tarwi)","en":"Lupin","pt":"Tremoço"}',true,NULL,
 ARRAY['tarwi','chocho','lupino','altramuz','harina de tarwi','lupin','lupine','lupini','lupin flour','tremoço','farinha de tremoço'],'{}',NULL),
('allergen','molluscs','water-outline',14,'{"es":"Moluscos","en":"Molluscs","pt":"Moluscos"}',true,NULL,
 ARRAY['mejillón','choro','almeja','ostra','calamar','pulpo','vieira','macha','sepia','caracol de mar','mussel','clam','oyster','squid','calamari','octopus','scallop','snail','escargot','oyster sauce','mexilhão','sururu','vôngole','lula','polvo','molho de ostra'],
 ARRAY['en polvo','polvo de hornear','em pó','leite em pó','pasta caracol','pan de concha'],NULL),
-- 2. Diets (prompt rules; gluten_free implies the gluten allergen)
('diet','vegetarian','leaf-outline',1,'{"es":"Vegetariano","en":"Vegetarian","pt":"Vegetariano"}',false,NULL,'{}','{}','No meat, poultry, fish, seafood, gelatin or meat broth for this member; plant proteins, eggs and dairy are fine.'),
('diet','vegan','flower-outline',2,'{"es":"Vegano","en":"Vegan","pt":"Vegano"}',false,NULL,'{}','{}','No animal products at all for this member: no meat, fish, dairy, eggs or honey.'),
('diet','pescatarian','fish-outline',3,'{"es":"Pescetariano","en":"Pescatarian","pt":"Pescetariano"}',false,NULL,'{}','{}','No meat or poultry for this member; fish and seafood are fine.'),
('diet','gluten_free','shield-checkmark-outline',4,'{"es":"Sin gluten","en":"Gluten-free","pt":"Sem glúten"}',false,'gluten','{}','{}','Strictly gluten-free: no wheat, barley, rye or regular oats, not even as flour, breading, beer or malt.'),
('diet','lactose_free','cafe-outline',5,'{"es":"Sin lactosa","en":"Lactose-free","pt":"Sem lactose"}',false,NULL,'{}','{}','No regular milk, fresh cheese, cream or ice cream for this member; lactose-free dairy, yogurt and hard cheeses are fine.'),
('diet','low_sugar','ice-cream-outline',6,'{"es":"Bajo en azúcar","en":"Low sugar","pt":"Pouco açúcar"}',false,NULL,'{}','{}','Low sugar: no sugary drinks, sweets, jams or added sugar; fruit in moderation.'),
('diet','low_salt','heart-outline',7,'{"es":"Bajo en sal","en":"Low salt","pt":"Pouco sal"}',false,NULL,'{}','{}','Low salt: no stock cubes, cured meats, salty snacks or canned food; season with herbs, garlic and lemon.'),
-- 3. Health conditions (sources in 03-scavenge-catalogos.md)
('condition','diabetes','water-outline',1,'{"es":"Diabetes","en":"Diabetes","pt":"Diabetes"}',false,NULL,'{}','{}','Diabetes: plate method (half vegetables, a quarter lean protein, a quarter whole grains); no sugary drinks or sweets; limit salt, saturated fat and alcohol.'),
('condition','hypertension','pulse-outline',2,'{"es":"Presión alta","en":"High blood pressure","pt":"Pressão alta"}',false,NULL,'{}','{}','High blood pressure (DASH): keep sodium low; avoid cured meats, stock cubes and salty snacks; more vegetables, fruit and legumes.'),
('condition','high_cholesterol','heart-outline',3,'{"es":"Colesterol alto","en":"High cholesterol","pt":"Colesterol alto"}',false,NULL,'{}','{}','High cholesterol: limit saturated and trans fat (fried food, pork rinds, lard), sodium and sugar; favour oats, legumes and fish.'),
('condition','celiac','ban-outline',4,'{"es":"Celiaquía","en":"Celiac disease","pt":"Doença celíaca"}',false,'gluten','{}','{}','Celiac disease: zero gluten, including flour, breading, beer and malt.'),
('condition','lactose_intolerance','cafe-outline',5,'{"es":"Intolerancia a la lactosa","en":"Lactose intolerance","pt":"Intolerância à lactose"}',false,NULL,'{}','{}','Lactose intolerance: use lactose-free dairy; yogurt and hard cheeses are usually fine.'),
('condition','pregnancy','woman-outline',6,'{"es":"Embarazo","en":"Pregnancy","pt":"Gravidez"}',true,NULL,
 ARRAY['alcohol','cerveza','vino','singani','chicha','ceviche','sushi','carne cruda','hígado','paté','mayonesa casera','queso sin pasteurizar','quesillo artesanal','pez espada','tiburón','beer','wine','raw fish','raw meat','liver','pate','swordfish','shark','unpasteurized cheese','cerveja','vinho','carne crua','fígado','patê','peixe cru','peixe espada','tubarão','queijo não pasteurizado'],'{}',
 'Pregnancy: no alcohol, raw or undercooked fish, meat or eggs, liver, pâté, unpasteurized dairy or large predator fish; limit caffeine to one coffee a day.'),
('condition','kidney_disease','medical-outline',7,'{"es":"Enfermedad renal","en":"Kidney disease","pt":"Doença renal"}',true,NULL,
 ARRAY['sal light','sustituto de sal','cloruro de potasio','salt substitute','potassium chloride','substituto de sal'],'{}',
 'Kidney disease: limit sodium, cured meats and phosphate additives; modest portions of high-potassium foods; never salt substitutes.'),
('condition','anemia','battery-half-outline',8,'{"es":"Anemia","en":"Anemia","pt":"Anemia"}',false,NULL,'{}','{}','Anemia: include iron-rich foods (lean meat, lentils, beans, spinach) with a source of vitamin C in the same meal.'),
('condition','gastritis','flame-outline',9,'{"es":"Gastritis","en":"Gastritis","pt":"Gastrite"}',false,NULL,'{}','{}','Gastritis: avoid alcohol and very spicy food (llajua, chili); keep fried food and coffee to a minimum.'),
('condition','overweight','scale-outline',10,'{"es":"Sobrepeso","en":"Overweight","pt":"Sobrepeso"}',false,NULL,'{}','{}','Overweight: generous vegetables, fruit, legumes and whole grains; less fat, sugar, salt and sugary drinks; suggest regular physical activity.'),
-- 4. Sports and activities
('activity','football','football-outline',1,'{"es":"Fútbol","en":"Soccer","pt":"Futebol"}',false,NULL,'{}','{}',NULL),
('activity','futsal','football-outline',2,'{"es":"Fútbol de salón","en":"Futsal","pt":"Futsal"}',false,NULL,'{}','{}',NULL),
('activity','basketball','basketball-outline',3,'{"es":"Básquet","en":"Basketball","pt":"Basquete"}',false,NULL,'{}','{}',NULL),
('activity','volleyball','baseball-outline',4,'{"es":"Vóley","en":"Volleyball","pt":"Vôlei"}',false,NULL,'{}','{}',NULL),
('activity','wally','tennisball-outline',5,'{"es":"Wally","en":"Wally","pt":"Wally"}',false,NULL,'{}','{}',NULL),
('activity','racquetball','tennisball-outline',6,'{"es":"Frontón / raquetbol","en":"Racquetball","pt":"Raquetebol"}',false,NULL,'{}','{}',NULL),
('activity','swimming','water-outline',7,'{"es":"Natación","en":"Swimming","pt":"Natação"}',false,NULL,'{}','{}',NULL),
('activity','cycling','bicycle-outline',8,'{"es":"Ciclismo","en":"Cycling","pt":"Ciclismo"}',false,NULL,'{}','{}',NULL),
('activity','walking','walk-outline',9,'{"es":"Caminata","en":"Walking","pt":"Caminhada"}',false,NULL,'{}','{}',NULL),
('activity','running','footsteps-outline',10,'{"es":"Correr","en":"Running","pt":"Corrida"}',false,NULL,'{}','{}',NULL),
('activity','gym','barbell-outline',11,'{"es":"Gimnasio","en":"Gym","pt":"Academia"}',false,NULL,'{}','{}',NULL),
('activity','yoga','body-outline',12,'{"es":"Yoga","en":"Yoga","pt":"Yoga"}',false,NULL,'{}','{}',NULL),
('activity','dance','musical-notes-outline',13,'{"es":"Baile","en":"Dance","pt":"Dança"}',false,NULL,'{}','{}',NULL),
('activity','martial_arts','hand-left-outline',14,'{"es":"Artes marciales","en":"Martial arts","pt":"Artes marciais"}',false,NULL,'{}','{}',NULL),
('activity','hiking','trail-sign-outline',15,'{"es":"Trekking / montaña","en":"Hiking","pt":"Trilha"}',false,NULL,'{}','{}',NULL),
('activity','family_outing','people-outline',16,'{"es":"Paseo en familia","en":"Family outing","pt":"Passeio em família"}',false,NULL,'{}','{}',NULL),
-- 5. Goals (same codes as the health_goal CHECK)
('goal','maintain','checkmark-circle-outline',1,'{"es":"Mantenerse","en":"Maintain","pt":"Manter"}',false,NULL,'{}','{}',NULL),
('goal','eat_healthier','nutrition-outline',2,'{"es":"Comer más sano","en":"Eat healthier","pt":"Comer mais saudável"}',false,NULL,'{}','{}',NULL),
('goal','lose_weight','trending-down-outline',3,'{"es":"Bajar de peso","en":"Lose weight","pt":"Perder peso"}',false,NULL,'{}','{}',NULL),
('goal','gain_muscle','barbell-outline',4,'{"es":"Ganar músculo","en":"Gain muscle","pt":"Ganhar músculo"}',false,NULL,'{}','{}',NULL),
('goal','more_energy','flash-outline',5,'{"es":"Más energía","en":"More energy","pt":"Mais energia"}',false,NULL,'{}','{}',NULL),
-- 6. Activity levels (same codes as the activity_level CHECK; WHO/CDC)
('activity_level','low','battery-dead-outline',1,'{"es":"Baja","en":"Low","pt":"Baixa"}',false,NULL,'{}','{}',NULL),
('activity_level','moderate','battery-half-outline',2,'{"es":"Moderada","en":"Moderate","pt":"Moderada"}',false,NULL,'{}','{}',NULL),
('activity_level','high','battery-full-outline',3,'{"es":"Alta","en":"High","pt":"Alta"}',false,NULL,'{}','{}',NULL);

-- Normalize once so SQL and TypeScript match the same strings.
UPDATE budget.thealth_option SET
  keywords = (SELECT COALESCE(array_agg(DISTINCT budget.f_norm_text(k)), '{}') FROM unnest(keywords) k WHERE budget.f_norm_text(k) <> ''),
  exclusions = (SELECT COALESCE(array_agg(DISTINCT budget.f_norm_text(e)), '{}') FROM unnest(exclusions) e WHERE budget.f_norm_text(e) <> '');

NOTIFY pgrst, 'reload schema';
