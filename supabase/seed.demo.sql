-- Optional local demo; run after migrations and seed.sql.
BEGIN;
-- ==============================================================================
-- SEED DATA (Local development test data)
-- Automatically executed by `supabase db reset` (npm run db:reset)
-- ==============================================================================

-- Reference catalogs are installed by migrations; only demo data belongs here.

-- 12. Households, Auxiliars, Members, Transactions & Transaction Details for Local Testing
INSERT INTO budget.thousehold (
    id, business_type_id, name, currency, created_at, created_by, status
) VALUES
    ('22222222-2222-4222-8222-222222222201', 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'Familia Morales', 'BOB', '2026-10-30 05:00:00+00', '6f521862-f9dd-450a-ab69-79de338e2269', 'active'),
    ('22222222-2222-4222-8222-222222222202', 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'Hogar Chumacero', 'BOB', '2026-10-30 05:00:00+00', '6f521862-f9dd-450a-ab69-79de338e2269', 'active')
ON CONFLICT (id) DO UPDATE SET business_type_id = EXCLUDED.business_type_id;

-- Additional test users for household members
INSERT INTO budget.tuser (
    id, full_name, email_user, locale, timezone, created_at, created_by, status, role
) VALUES
    ('18598847-ee9d-4638-aee8-ed4d30770664', 'Valentina Morales', 'valentina@demo.local', 'es', 'UTC', '2026-10-30 05:00:00+00', '6f521862-f9dd-450a-ab69-79de338e2269', 'active', 'member'),
    ('88888888-8888-4888-8888-888888888801', 'Carlos Morales', 'carlos@demo.local', 'es', 'UTC', '2026-10-30 05:00:00+00', '6f521862-f9dd-450a-ab69-79de338e2269', 'active', 'member')
ON CONFLICT (email_user) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Auxiliars linked to your tauxiliar_type IDs
INSERT INTO budget.tauxiliar (
    id, auxiliar_type_id, parent_id, household_id, code, name, description, created_at, created_by, status
) VALUES
    ('66666666-6666-4666-8666-666666666601', '11ce16ae-62a5-4c3e-8306-8b1b241a9762', null, '22222222-2222-4222-8222-222222222201', 'AUX-COMP', 'Supermercados y Comercios', 'Vendor auxiliar for daily purchases', '2026-10-30 05:05:00+00', '6f521862-f9dd-450a-ab69-79de338e2269', 'active'),
    ('66666666-6666-4666-8666-666666666602', 'f6714980-c452-4d02-afae-5837aedb793a', null, '22222222-2222-4222-8222-222222222201', 'AUX-PERS', 'Miembro Familiar', 'Person auxiliar for family members', '2026-10-30 05:05:00+00', '6f521862-f9dd-450a-ab69-79de338e2269', 'active'),
    ('66666666-6666-4666-8666-666666666603', '4c49da40-62b2-4b44-9ba9-2e54d0bec78f', null, '22222222-2222-4222-8222-222222222201', 'AUX-INV', 'Fondo Vacaciones', 'Investment auxiliar for family savings', '2026-10-30 05:05:00+00', '6f521862-f9dd-450a-ab69-79de338e2269', 'active')
ON CONFLICT (id) DO UPDATE SET
    auxiliar_type_id = EXCLUDED.auxiliar_type_id,
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Link all users in budget.tuser to both households
INSERT INTO budget.thousehold_member (
    household_id, user_id, role, auxiliar_id, member_type, status, created_by
)
SELECT
    '22222222-2222-4222-8222-222222222201',
    u.id,
    CASE WHEN u.email_user LIKE '%carlos%' THEN 'member' ELSE 'admin' END,
    '66666666-6666-4666-8666-666666666602',
    CASE WHEN u.email_user LIKE '%valentina%' THEN 'mom' ELSE 'dad' END,
    'active',
    '6f521862-f9dd-450a-ab69-79de338e2269'
FROM budget.tuser u
ON CONFLICT (household_id, user_id) DO NOTHING;

INSERT INTO budget.thousehold_member (
    household_id, user_id, role, auxiliar_id, member_type, status, created_by
)
SELECT
    '22222222-2222-4222-8222-222222222202',
    u.id,
    'admin',
    '66666666-6666-4666-8666-666666666602',
    'dad',
    'active',
    '6f521862-f9dd-450a-ab69-79de338e2269'
FROM budget.tuser u
ON CONFLICT (household_id, user_id) DO NOTHING;

-- 13. Seed Transactions (budget.ttransaction) using your template_transaction_id ('27abf4b0-2cf9-4279-9f51-0833142e64f9')
INSERT INTO budget.ttransaction (
    id, household_id, template_transaction_id, transaction_date, operation_code, concept, type, amount, external_reference, source_text, input_data, recorded_via, created_at, created_by, status
) VALUES
    (
        '99999999-9999-4999-8999-999999999901',
        '22222222-2222-4222-8222-222222222201',
        '27abf4b0-2cf9-4279-9f51-0833142e64f9',
        now() - interval '2 hours',
        'OP-1001',
        'Jumbo Bilbao',
        'expense',
        64200,
        'Débito Nido',
        'Compra supermercado semanal en Jumbo Bilbao',
        '{"amount": 64200, "category": "Supermarket and Groceries"}'::jsonb,
        'whatsapp',
        now() - interval '2 hours',
        '18598847-ee9d-4638-aee8-ed4d30770664',
        'active'
    ),
    (
        '99999999-9999-4999-8999-999999999902',
        '22222222-2222-4222-8222-222222222201',
        '27abf4b0-2cf9-4279-9f51-0833142e64f9',
        now() - interval '4 hours',
        'OP-1002',
        'Farmacias Ahumada',
        'expense',
        12800,
        'Boleta split 50/50',
        'Compra medicamentos recetados',
        '{"amount": 12800, "category": "Health and Pharmacy"}'::jsonb,
        'whatsapp',
        now() - interval '4 hours',
        '88888888-8888-4888-8888-888888888801',
        'active'
    ),
    (
        '99999999-9999-4999-8999-999999999903',
        '22222222-2222-4222-8222-222222222201',
        '27abf4b0-2cf9-4279-9f51-0833142e64f9',
        now() - interval '1 day 2 hours',
        'OP-1003',
        'Copec Vitacura',
        'expense',
        32000,
        'Auto familiar',
        'Carga de gasolina tanque lleno',
        '{"amount": 32000, "category": "Transportation and Fuel"}'::jsonb,
        'telegram',
        now() - interval '1 day 2 hours',
        '88888888-8888-4888-8888-888888888801',
        'active'
    ),
    (
        '99999999-9999-4999-8999-999999999904',
        '22222222-2222-4222-8222-222222222201',
        '27abf4b0-2cf9-4279-9f51-0833142e64f9',
        now() - interval '1 day 5 hours',
        'OP-1004',
        'Netflix Familiar',
        'expense',
        10990,
        'Recurrente',
        'Débito automático suscripción hogar',
        '{"amount": 10990, "category": "Utilities"}'::jsonb,
        'whatsapp',
        now() - interval '1 day 5 hours',
        '6f521862-f9dd-450a-ab69-79de338e2269',
        'active'
    ),
    (
        '99999999-9999-4999-8999-999999999905',
        '22222222-2222-4222-8222-222222222201',
        '27abf4b0-2cf9-4279-9f51-0833142e64f9',
        now() - interval '3 days',
        'OP-1005',
        'Librería Antártica',
        'expense',
        18500,
        'Escolares',
        'Compra materiales Colegio Mateo',
        '{"amount": 18500, "category": "Education and School"}'::jsonb,
        'whatsapp',
        now() - interval '3 days',
        '18598847-ee9d-4638-aee8-ed4d30770664',
        'active'
    ),
    (
        '99999999-9999-4999-8999-999999999906',
        '22222222-2222-4222-8222-222222222201',
        '27abf4b0-2cf9-4279-9f51-0833142e64f9',
        now() - interval '3 days 4 hours',
        'OP-1006',
        'Ahorro Vacaciones',
        'income',
        150000,
        'Meta Conjunta',
        'Depósito mensual fondo de vacaciones',
        '{"amount": 150000, "category": "Savings and Investments"}'::jsonb,
        'telegram',
        now() - interval '3 days 4 hours',
        '6f521862-f9dd-450a-ab69-79de338e2269',
        'active'
    )
ON CONFLICT (id) DO UPDATE SET
    template_transaction_id = EXCLUDED.template_transaction_id,
    concept = EXCLUDED.concept,
    amount = EXCLUDED.amount,
    input_data = EXCLUDED.input_data;

-- 14. Seed Transaction Details (budget.ttransaction_detail)
-- Each transaction has its double-entry accounting lines (Debit & Credit) matching ttemplate_transaction_det:
-- Line 1: Debit to expense/investment account (510 Feeding / 130 Investments)
-- Line 2: Credit to Cash account (110 Cash: 'ee7fc903-bfb0-4332-8395-039fcaabbcd1')
DELETE FROM budget.ttransaction_detail
WHERE transaction_id IN (
    '99999999-9999-4999-8999-999999999901',
    '99999999-9999-4999-8999-999999999902',
    '99999999-9999-4999-8999-999999999903',
    '99999999-9999-4999-8999-999999999904',
    '99999999-9999-4999-8999-999999999905',
    '99999999-9999-4999-8999-999999999906'
);

INSERT INTO budget.ttransaction_detail (
    id, transaction_id, account_id, auxiliar_id, budget_type_id, item_code, description, unit_measure_code, quantity, unit_price, debit_base, credit_base, created_by, status
) VALUES
    -- Tx 1: Jumbo Bilbao (64,200) -> Supermarket and Groceries ('c9f2530b-c52a-4d4b-81aa-775fffc19fa3')
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '99999999-9999-4999-8999-999999999901', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', 'c9f2530b-c52a-4d4b-81aa-775fffc19fa3', 'ITM-001', 'Debit record - Compra supermercado Jumbo Bilbao', 'unit', 1, 64200, 64200, 0, '18598847-ee9d-4638-aee8-ed4d30770664', 'active'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', '99999999-9999-4999-8999-999999999901', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', 'c9f2530b-c52a-4d4b-81aa-775fffc19fa3', 'ITM-001', 'Credit record - Pago con Cash/Débito', 'unit', 1, 64200, 0, 64200, '18598847-ee9d-4638-aee8-ed4d30770664', 'active'),

    -- Tx 2: Farmacias Ahumada (12,800) -> Health and Pharmacy ('c8a40cf3-f58d-4226-9bf9-71942d497546')
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', '99999999-9999-4999-8999-999999999902', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', 'c8a40cf3-f58d-4226-9bf9-71942d497546', 'ITM-002', 'Debit record - Medicamentos Farmacias Ahumada', 'unit', 1, 12800, 12800, 0, '88888888-8888-4888-8888-888888888801', 'active'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', '99999999-9999-4999-8999-999999999902', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', 'c8a40cf3-f58d-4226-9bf9-71942d497546', 'ITM-002', 'Credit record - Pago Cash/Débito', 'unit', 1, 12800, 0, 12800, '88888888-8888-4888-8888-888888888801', 'active'),

    -- Tx 3: Copec Vitacura (32,000) -> Transportation and Fuel ('07a56835-b3a0-40ff-ad33-3afaed38f4ae')
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', '99999999-9999-4999-8999-999999999903', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', '07a56835-b3a0-40ff-ad33-3afaed38f4ae', 'ITM-003', 'Debit record - Combustible Copec Vitacura', 'unit', 1, 32000, 32000, 0, '88888888-8888-4888-8888-888888888801', 'active'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', '99999999-9999-4999-8999-999999999903', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', '07a56835-b3a0-40ff-ad33-3afaed38f4ae', 'ITM-003', 'Credit record - Pago Cash/Débito', 'unit', 1, 32000, 0, 32000, '88888888-8888-4888-8888-888888888801', 'active'),

    -- Tx 4: Netflix Familiar (10,990) -> Utilities ('35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b')
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', '99999999-9999-4999-8999-999999999904', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', '35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b', 'ITM-004', 'Debit record - Suscripción mensual Netflix', 'unit', 1, 10990, 10990, 0, '6f521862-f9dd-450a-ab69-79de338e2269', 'active'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14', '99999999-9999-4999-8999-999999999904', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', '35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b', 'ITM-004', 'Credit record - Pago automático Cash', 'unit', 1, 10990, 0, 10990, '6f521862-f9dd-450a-ab69-79de338e2269', 'active'),

    -- Tx 5: Librería Antártica (18,500) -> Education and School ('619bcd10-bd18-4635-af69-c62a4ae39018')
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05', '99999999-9999-4999-8999-999999999905', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', '619bcd10-bd18-4635-af69-c62a4ae39018', 'ITM-005', 'Debit record - Materiales escolares Colegio Mateo', 'unit', 1, 18500, 18500, 0, '18598847-ee9d-4638-aee8-ed4d30770664', 'active'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15', '99999999-9999-4999-8999-999999999905', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', '619bcd10-bd18-4635-af69-c62a4ae39018', 'ITM-005', 'Credit record - Pago Cash/Débito', 'unit', 1, 18500, 0, 18500, '18598847-ee9d-4638-aee8-ed4d30770664', 'active'),

    -- Tx 6: Ahorro Vacaciones (150,000) -> Savings and Investments ('e2c05b09-7bd8-4d65-9421-4715248b2ddf') & Account Investments ('bc54a393-dcf2-4d08-a34b-cab17438af3b')
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06', '99999999-9999-4999-8999-999999999906', 'bc54a393-dcf2-4d08-a34b-cab17438af3b', '66666666-6666-4666-8666-666666666603', 'e2c05b09-7bd8-4d65-9421-4715248b2ddf', 'ITM-006', 'Debit record - Depósito en Fondo Vacaciones', 'unit', 1, 150000, 150000, 0, '6f521862-f9dd-450a-ab69-79de338e2269', 'active'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16', '99999999-9999-4999-8999-999999999906', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666603', 'e2c05b09-7bd8-4d65-9421-4715248b2ddf', 'ITM-006', 'Credit record - Aporte meta ahorro familiar', 'unit', 1, 150000, 0, 150000, '6f521862-f9dd-450a-ab69-79de338e2269', 'active')
ON CONFLICT (id) DO NOTHING;

-- Also assign 2 transactions to rodrychm@gmail.com if that Google user is already logged in locally
UPDATE budget.ttransaction
SET created_by = (SELECT id FROM budget.tuser WHERE email_user = 'rodrychm@gmail.com' LIMIT 1)
WHERE id IN ('99999999-9999-4999-8999-999999999904', '99999999-9999-4999-8999-999999999906')
  AND EXISTS (SELECT 1 FROM budget.tuser WHERE email_user = 'rodrychm@gmail.com');


-- Resolve demo postings to the household's own chart, not global templates.
UPDATE budget.ttransaction_detail d SET account_id=owned.id
FROM budget.ttransaction t,budget.taccount original,budget.taccount owned
WHERE d.transaction_id=t.id AND original.id=d.account_id
 AND owned.household_id=t.household_id AND owned.code=original.code
 AND t.id IN ('99999999-9999-4999-8999-999999999901','99999999-9999-4999-8999-999999999902',
 '99999999-9999-4999-8999-999999999903','99999999-9999-4999-8999-999999999904',
 '99999999-9999-4999-8999-999999999905','99999999-9999-4999-8999-999999999906');
UPDATE budget.ttransaction t SET template_transaction_id=tpl.id,ledger_version=1
FROM budget.ttemplate_transaction tpl
WHERE tpl.household_id=t.household_id AND tpl.code='expense_paid'
 AND t.id IN ('99999999-9999-4999-8999-999999999901','99999999-9999-4999-8999-999999999902',
 '99999999-9999-4999-8999-999999999903','99999999-9999-4999-8999-999999999904',
 '99999999-9999-4999-8999-999999999905','99999999-9999-4999-8999-999999999906');
-- Moving cash into savings is a transfer between assets, not earned income.
UPDATE budget.ttransaction SET type='transfer' WHERE id='99999999-9999-4999-8999-999999999906';
COMMIT;
