-- ==============================================================================
-- Migration: Master Catalogs and Bootstrap Data
-- File: 20261031200000_master_catalogs_and_bootstrap_data.sql
-- Description:
--   Consolidates all foundational system catalogs and bootstrap data in strict
--   dependency precedence (prelación) so that running migrations from scratch
--   (both locally and on Supabase Cloud) succeeds with zero foreign key violations.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BASE USERS (Must exist first for created_by / updated_by foreign keys)
-- ------------------------------------------------------------------------------
INSERT INTO budget.tuser (
    id, full_name, email_user, locale, timezone, role, status, created_at
) VALUES 
    ('6f521862-f9dd-450a-ab69-79de338e2269', 'System Admin', 'admin@kplian.com', 'es', 'UTC', 'admin', 'active', '2026-10-26 22:20:24.7416+00'),
    ('18598847-ee9d-4638-aee8-ed4d30770664', 'Valentina Smith', 'valentina@demo.local', 'es', 'UTC', 'member', 'active', '2026-10-30 05:00:00+00'),
    ('88888888-8888-4888-8888-888888888801', 'Carlos Aaron', 'carlos@demo.local', 'es', 'UTC', 'member', 'active', '2026-10-30 05:00:00+00')
ON CONFLICT (email_user) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- ------------------------------------------------------------------------------
-- 2. SYSTEM LANGUAGES
-- ------------------------------------------------------------------------------
INSERT INTO budget.tlanguage (
    id, code, name, status, created_by
) VALUES
    ('11111111-1111-4111-8111-000000000001', 'es', 'Español', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('11111111-1111-4111-8111-000000000002', 'en', 'English', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('11111111-1111-4111-8111-000000000003', 'pt', 'Português', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. ACCOUNT TYPES
-- ------------------------------------------------------------------------------
INSERT INTO budget.taccount_type (
    id, code, name, normal_balance, status, created_by
) VALUES 
    ('640c078c-2165-49b9-a815-8c38d0b25121', 'asset', 'Asset', 'debit', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('fe129378-65f7-423e-a290-5ecc298a0914', 'liability', 'Liability', 'credit', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('2d28afba-68fe-4adc-ad2e-0a7525806799', 'equity', 'Equity', 'credit', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('6b241f01-36a5-4371-abaf-59f1d6a98fbc', 'income', 'Income', 'credit', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b53ee22b-376c-4391-ade5-9f933af44c19', 'expense', 'Expense', 'debit', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. AUXILIAR TYPES
-- ------------------------------------------------------------------------------
INSERT INTO budget.tauxiliar_type (
    id, code, name, status, created_by
) VALUES 
    ('11ce16ae-62a5-4c3e-8306-8b1b241a9762', 'company', 'Company', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('1a3628f0-e518-4536-b731-d97ae6a2b96a', 'loan', 'Loan', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('4c49da40-62b2-4b44-9ba9-2e54d0bec78f', 'investment', 'Investment', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b2491c87-f9c3-4672-9877-4c6978822363', 'project', 'Project', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('f6714980-c452-4d02-afae-5837aedb793a', 'person', 'Person', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. BUSINESS TYPES
-- ------------------------------------------------------------------------------
INSERT INTO budget.tbusiness_type (
    id, code, name, status, created_by
) VALUES 
    ('e1d42022-fca8-43f2-a37d-7823372fddb0', 'household', 'Household', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('fdefc1d6-97a7-44f7-bd53-d11bcd5efa0b', 'pyme', 'Small Business', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. MASTER CHART OF ACCOUNTS (Base templates where household_id IS NULL)
-- ------------------------------------------------------------------------------
INSERT INTO budget.taccount (
    id, household_id, account_type_id, parent_id, required_auxiliar_type_id, business_type_id, code, name, currency, requires_auxiliar, is_postable, status, created_by
) VALUES 
    ('ee7fc903-bfb0-4332-8395-039fcaabbcd1', null, '640c078c-2165-49b9-a815-8c38d0b25121', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '110', 'Cash', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('1efe291f-49a6-4306-9b79-dd910b36fbcd', null, '640c078c-2165-49b9-a815-8c38d0b25121', null, 'f6714980-c452-4d02-afae-5837aedb793a', 'e1d42022-fca8-43f2-a37d-7823372fddb0', '120', 'Loans receivable', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('bc54a393-dcf2-4d08-a34b-cab17438af3b', null, '640c078c-2165-49b9-a815-8c38d0b25121', null, '4c49da40-62b2-4b44-9ba9-2e54d0bec78f', 'e1d42022-fca8-43f2-a37d-7823372fddb0', '130', 'Investments', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('8b7dd11f-9bfb-42a3-bfc9-e33a23bb4f3f', null, 'fe129378-65f7-423e-a290-5ecc298a0914', null, '11ce16ae-62a5-4c3e-8306-8b1b241a9762', 'e1d42022-fca8-43f2-a37d-7823372fddb0', '210', 'Loans payable', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('fce31321-7129-42dc-8e31-6ecda16b9f89', null, '2d28afba-68fe-4adc-ad2e-0a7525806799', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '310', 'Opening balances', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c4100000-0000-4000-8000-000000000410', null, '6b241f01-36a5-4371-abaf-59f1d6a98fbc', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '410', 'Income and Earnings', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d556c3ae-9a60-4c07-8010-234584ea5cf1', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '510', 'Feeding', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('5ad35085-0238-4f37-b1fe-320b2106abea', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '520', 'Interest paid', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c5300000-0000-4000-8000-000000000530', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '530', 'Transportation and Fuel', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c5400000-0000-4000-8000-000000000540', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '540', 'Utilities', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c5500000-0000-4000-8000-000000000550', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '550', 'Housing and Home', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c5600000-0000-4000-8000-000000000560', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '560', 'Health and Pharmacy', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c5700000-0000-4000-8000-000000000570', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '570', 'Education and School', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c5800000-0000-4000-8000-000000000580', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '580', 'Restaurants and Outings', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c5900000-0000-4000-8000-000000000590', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '590', 'Clothing and Personal Care', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c6000000-0000-4000-8000-000000000600', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '600', 'Pets', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c6100000-0000-4000-8000-000000000610', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '610', 'Insurance', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c6200000-0000-4000-8000-000000000620', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '620', 'Taxes and Fees', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c6900000-0000-4000-8000-000000000690', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '690', 'Other Expenses', 'BOB', false, true, 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. MASTER TRANSACTION TEMPLATES (Base templates where household_id IS NULL)
-- ------------------------------------------------------------------------------
INSERT INTO budget.ttemplate_transaction (
    id, business_type_id, household_id, code, name, version, description, input_schema, status, created_by
) VALUES 
    ('4b2e6d06-5c4e-415e-b889-b550ca35181b', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'purchase', 'Purchase Template', 1, 'General purchase of goods and groceries', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0010000-0000-4000-8000-000000000001', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_transportation_fuel', 'Transportation and Fuel Template', 1, 'Fuel, transport, taxis', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0020000-0000-4000-8000-000000000002', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_debts_loans', 'Debts and Loans Template', 1, 'Debt and loan payments', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0030000-0000-4000-8000-000000000003', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_pets', 'Pets Template', 1, 'Pet food and vet expenses', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0040000-0000-4000-8000-000000000004', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_taxes_fees', 'Taxes and Fees Template', 1, 'Government taxes, fees, documents', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0050000-0000-4000-8000-000000000005', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_restaurants_leisure', 'Restaurants and Outings Template', 1, 'Restaurants, outings, leisure', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0060000-0000-4000-8000-000000000006', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_utilities', 'Utilities Template', 1, 'Electricity, water, gas, internet', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0070000-0000-4000-8000-000000000007', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_clothing_personal_care', 'Clothing and Personal Care Template', 1, 'Apparel, care, hygiene', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0080000-0000-4000-8000-000000000008', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_other', 'Other Expenses Template', 1, 'Miscellaneous and uncategorized', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0090000-0000-4000-8000-000000000009', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_children_education', 'Education and School Template', 1, 'School, college, courses, books', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0100000-0000-4000-8000-000000000010', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_insurance', 'Insurance Template', 1, 'Health, home, car insurance', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0110000-0000-4000-8000-000000000011', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_housing', 'Housing and Home Template', 1, 'Rent, mortgage, house maintenance', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0120000-0000-4000-8000-000000000012', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_health_pharmacy', 'Health and Pharmacy Template', 1, 'Pharmacy, doctors, clinics', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0140000-0000-4000-8000-000000000014', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_savings_investments', 'Savings and Investments Template', 1, 'Savings allocation, investment funds', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('b0150000-0000-4000-8000-000000000015', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_income_general', 'Income General Template', 1, 'Salary and earnings', '{}', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. MASTER TEMPLATE DETAILS (Debit / Credit lines for each template)
-- ------------------------------------------------------------------------------
INSERT INTO budget.ttemplate_transaction_det (
    id, template_transaction_id, line_number, account_id, account_input_key, side, amount_rule, description_template, status, created_by
) VALUES 
    -- Purchase Template (4b2e) -> Debit 510 Feeding, Credit 110 Cash
    ('765e2beb-1fad-4ce5-a999-6f077a091260', '4b2e6d06-5c4e-415e-b889-b550ca35181b', 1, 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '', 'debit', '{"var": "amount"}', 'Debit record', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('f7fdd01e-ece6-4421-997a-b0a5daac8005', '4b2e6d06-5c4e-415e-b889-b550ca35181b', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Credit record', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Transportation Template (b001) -> Debit 530, Credit 110
    ('d0010001-0000-4000-8000-000000000001', 'b0010000-0000-4000-8000-000000000001', 1, 'c5300000-0000-4000-8000-000000000530', '', 'debit', '{"var": "amount"}', 'Gasto Transporte', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0010002-0000-4000-8000-000000000002', 'b0010000-0000-4000-8000-000000000001', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Debts & Loans Template (b002) -> Debit 520, Credit 110
    ('d0020001-0000-4000-8000-000000000001', 'b0020000-0000-4000-8000-000000000002', 1, '5ad35085-0238-4f37-b1fe-320b2106abea', '', 'debit', '{"var": "amount"}', 'Pago Deudas/Préstamos', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0020002-0000-4000-8000-000000000002', 'b0020000-0000-4000-8000-000000000002', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Pets Template (b003) -> Debit 600, Credit 110
    ('d0030001-0000-4000-8000-000000000001', 'b0030000-0000-4000-8000-000000000003', 1, 'c6000000-0000-4000-8000-000000000600', '', 'debit', '{"var": "amount"}', 'Gasto Mascotas', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0030002-0000-4000-8000-000000000002', 'b0030000-0000-4000-8000-000000000003', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Taxes & Fees Template (b004) -> Debit 620, Credit 110
    ('d0040001-0000-4000-8000-000000000001', 'b0040000-0000-4000-8000-000000000004', 1, 'c6200000-0000-4000-8000-000000000620', '', 'debit', '{"var": "amount"}', 'Impuestos y Trámites', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0040002-0000-4000-8000-000000000002', 'b0040000-0000-4000-8000-000000000004', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Restaurants & Outings Template (b005) -> Debit 580, Credit 110
    ('d0050001-0000-4000-8000-000000000001', 'b0050000-0000-4000-8000-000000000005', 1, 'c5800000-0000-4000-8000-000000000580', '', 'debit', '{"var": "amount"}', 'Restaurantes y Salidas', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0050002-0000-4000-8000-000000000002', 'b0050000-0000-4000-8000-000000000005', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Utilities Template (b006) -> Debit 540, Credit 110
    ('d0060001-0000-4000-8000-000000000001', 'b0060000-0000-4000-8000-000000000006', 1, 'c5400000-0000-4000-8000-000000000540', '', 'debit', '{"var": "amount"}', 'Servicios Básicos', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0060002-0000-4000-8000-000000000002', 'b0060000-0000-4000-8000-000000000006', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Clothing & Personal Care Template (b007) -> Debit 590, Credit 110
    ('d0070001-0000-4000-8000-000000000001', 'b0070000-0000-4000-8000-000000000007', 1, 'c5900000-0000-4000-8000-000000000590', '', 'debit', '{"var": "amount"}', 'Ropa y Cuidado Personal', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0070002-0000-4000-8000-000000000002', 'b0070000-0000-4000-8000-000000000007', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Other Expenses Template (b008) -> Debit 690, Credit 110
    ('d0080001-0000-4000-8000-000000000001', 'b0080000-0000-4000-8000-000000000008', 1, 'c6900000-0000-4000-8000-000000000690', '', 'debit', '{"var": "amount"}', 'Otros Gastos', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0080002-0000-4000-8000-000000000002', 'b0080000-0000-4000-8000-000000000008', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Education & School Template (b009) -> Debit 570, Credit 110
    ('d0090001-0000-4000-8000-000000000001', 'b0090000-0000-4000-8000-000000000009', 1, 'c5700000-0000-4000-8000-000000000570', '', 'debit', '{"var": "amount"}', 'Educación y Colegio', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0090002-0000-4000-8000-000000000002', 'b0090000-0000-4000-8000-000000000009', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Insurance Template (b010) -> Debit 610, Credit 110
    ('d0100001-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000010', 1, 'c6100000-0000-4000-8000-000000000610', '', 'debit', '{"var": "amount"}', 'Seguros', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0100002-0000-4000-8000-000000000002', 'b0100000-0000-4000-8000-000000000010', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Housing & Home Template (b011) -> Debit 550, Credit 110
    ('d0110001-0000-4000-8000-000000000001', 'b0110000-0000-4000-8000-000000000011', 1, 'c5500000-0000-4000-8000-000000000550', '', 'debit', '{"var": "amount"}', 'Vivienda y Hogar', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0110002-0000-4000-8000-000000000002', 'b0110000-0000-4000-8000-000000000011', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Health & Pharmacy Template (b012) -> Debit 560, Credit 110
    ('d0120001-0000-4000-8000-000000000001', 'b0120000-0000-4000-8000-000000000012', 1, 'c5600000-0000-4000-8000-000000000560', '', 'debit', '{"var": "amount"}', 'Salud y Farmacia', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0120002-0000-4000-8000-000000000002', 'b0120000-0000-4000-8000-000000000012', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Savings & Investments Template (b014) -> Debit 130, Credit 110
    ('d0140001-0000-4000-8000-000000000001', 'b0140000-0000-4000-8000-000000000014', 1, 'bc54a393-dcf2-4d08-a34b-cab17438af3b', '', 'debit', '{"var": "amount"}', 'Inversión y Ahorro', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0140002-0000-4000-8000-000000000002', 'b0140000-0000-4000-8000-000000000014', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', 'Pago Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Income General Template (b015) -> Debit 110 Cash, Credit 410 Income
    ('d0150001-0000-4000-8000-000000000001', 'b0150000-0000-4000-8000-000000000015', 1, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'debit', '{"var": "amount"}', 'Ingreso en Efectivo', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('d0150002-0000-4000-8000-000000000002', 'b0150000-0000-4000-8000-000000000015', 2, 'c4100000-0000-4000-8000-000000000410', '', 'credit', '{"var": "amount"}', 'Ingreso Salarial/Cobro', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. MASTER BUDGET CATEGORIES (Base categories linked to their templates)
-- ------------------------------------------------------------------------------
INSERT INTO budget.tbudget_type (
    id, household_id, business_type_id, category_key, name, description, template_transaction_id, status, created_by
) VALUES 
    ('07a56835-b3a0-40ff-ad33-3afaed38f4ae', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'transportation_fuel', 'Transportation and Fuel', 'Gasoline, budget transportation, taxis, ride-hailing apps', 'b0010000-0000-4000-8000-000000000001', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('22506fa9-03df-4e6a-9d44-c531f7d01c89', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'debts_loans', 'Debts and Loans', 'Loan payments, credit card payments, interest', 'b0020000-0000-4000-8000-000000000002', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('30b93bec-e24a-4001-940a-ecc22033b161', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'pets', 'Pets', 'Pet food, veterinary care, medication, accessories', 'b0030000-0000-4000-8000-000000000003', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('31c7ac4c-0dc7-4d0a-9a3e-7a7f60102353', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'taxes_fees', 'Taxes and Fees', 'Taxes, documents, administrative procedures, fines', 'b0040000-0000-4000-8000-000000000004', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('3597c2b5-5d2c-4f6c-800a-674e2e88ee93', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'restaurants_leisure', 'Restaurants and Outings', 'Restaurants, cafés, bars, family outings, related entertainment', 'b0050000-0000-4000-8000-000000000005', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'utilities', 'Utilities', 'Electricity, water, gas, internet, phone', 'b0060000-0000-4000-8000-000000000006', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('4b501e74-3166-4916-a3fb-78e43caab160', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'clothing_personal_care', 'Clothing and Personal Care', 'Clothing, shoes, haircuts, personal care products', 'b0070000-0000-4000-8000-000000000007', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('5ed99dba-e49f-4a54-902d-4f32a62338bc', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'other', 'Other', 'Expenses that do not fit into another category', 'b0080000-0000-4000-8000-000000000008', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('619bcd10-bd18-4635-af69-c62a4ae39018', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'children_education', 'Education and School', 'Tuition, university, school supplies, books, courses', 'b0090000-0000-4000-8000-000000000009', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('987fb87c-3fde-451e-901a-4d1a64c9b903', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'insurance', 'Insurance', 'Health, vehicle, home, life insurance', 'b0100000-0000-4000-8000-000000000010', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('a2a05b9b-2b43-4fe1-9565-ccf41625fed9', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'housing', 'Housing and Home', 'Rent/mortgage payments, maintenance, repairs', 'b0110000-0000-4000-8000-000000000011', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c8a40cf3-f58d-4226-9bf9-71942d497546', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'health_pharmacy', 'Health and Pharmacy', 'Medication, medical consultations, doctors, dental care, medical tests', 'b0120000-0000-4000-8000-000000000012', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('c9f2530b-c52a-4d4b-81aa-775fffc19fa3', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'supermarket_groceries', 'Supermarket and Groceries', 'Food for home consumption, beverages, cleaning products, basic hygiene products', '4b2e6d06-5c4e-415e-b889-b550ca35181b', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('e2c05b09-7bd8-4d65-9421-4715248b2ddf', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'savings_investments', 'Savings and Investments', 'Monthly savings, investments, emergency fund', 'b0140000-0000-4000-8000-000000000014', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO UPDATE SET
    template_transaction_id = EXCLUDED.template_transaction_id;

-- ------------------------------------------------------------------------------
-- 10. MASTER FINANCIAL PYRAMID
-- ------------------------------------------------------------------------------
INSERT INTO budget.tfinancial_pyramid (
    id, business_type_id, household_id, code, name, description, status, created_by
) VALUES 
    ('f8505c97-2cac-4184-ad23-72c9d5086b4d', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'basic', 'Basic expenses/incomes', 'Master hierarchy for personal & family financial pyramid', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 11. FINANCIAL PYRAMID LEVELS
-- ------------------------------------------------------------------------------
INSERT INTO budget.tfinancial_pyramid_level (
    id, financial_pyramid_id, code, name, order_by, min_percentage, max_percentage, status, created_by
) VALUES 
    ('7118a455-336a-4a92-9552-dd461e84b532', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '1', 'Basic needs', 1, 20, 20, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('1f4f887d-f84d-4b63-b9e8-aaf624923a1f', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '2', 'Security', 2, 20, 20, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('478f76fe-0c34-4013-86fa-af93354c296b', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '3', 'Comfort', 3, 20, 20, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('0710f965-b54f-4e91-b219-c41b57e8215b', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '4', 'Experiences', 4, 20, 20, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('e7631ade-d1f8-40bb-b240-daec5f324672', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '5', 'Luxuries', 5, 20, 20, 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 12. BUDGET TYPE TO PYRAMID LEVEL MAPPING
-- ------------------------------------------------------------------------------
INSERT INTO budget.tbudget_type_pyramid_level (
    id, financial_pyramid_level_id, budget_type_id, status, created_by
) VALUES 
    ('b5d1fdba-bd42-4ec2-9f47-c49434c07ccb', '7118a455-336a-4a92-9552-dd461e84b532', '07a56835-b3a0-40ff-ad33-3afaed38f4ae', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Transportation -> Basic
    ('986230c6-8ee9-41d3-b89e-d9baf93503fe', '7118a455-336a-4a92-9552-dd461e84b532', '35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Utilities -> Basic
    ('a508f421-1d14-4da0-ac41-78f04c6f3a32', '7118a455-336a-4a92-9552-dd461e84b532', 'c9f2530b-c52a-4d4b-81aa-775fffc19fa3', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Supermarket -> Basic
    ('c68c4cd0-2c84-4931-8c24-75c8a8bff3d1', '7118a455-336a-4a92-9552-dd461e84b532', 'a2a05b9b-2b43-4fe1-9565-ccf41625fed9', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Housing -> Basic
    ('fe5562f5-366c-4e49-8689-6230ad7e28b1', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', '22506fa9-03df-4e6a-9d44-c531f7d01c89', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Debts -> Security
    ('ef49f34e-dc8e-4f38-ad4a-66dfe6ad50a3', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', '31c7ac4c-0dc7-4d0a-9a3e-7a7f60102353', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Taxes -> Security
    ('873457ae-f094-4e23-8fdf-b0f6f9febf49', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', '987fb87c-3fde-451e-901a-4d1a64c9b903', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Insurance -> Security
    ('73a7907e-f82a-4048-86be-6be87cc87e51', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', 'c8a40cf3-f58d-4226-9bf9-71942d497546', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Health -> Security
    ('66ddfd42-9633-439d-a106-b159e104e58a', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', '619bcd10-bd18-4635-af69-c62a4ae39018', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Education -> Security
    ('64862ef3-47aa-441e-a921-dcc5edc32857', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', 'e2c05b09-7bd8-4d65-9421-4715248b2ddf', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Savings -> Security
    ('7398905c-8cd9-4bde-a59b-cea48b3b3885', '478f76fe-0c34-4013-86fa-af93354c296b', '30b93bec-e24a-4001-940a-ecc22033b161', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Pets -> Comfort
    ('2b1e021e-c6a0-4903-bb30-4d66e473cfdc', '478f76fe-0c34-4013-86fa-af93354c296b', '4b501e74-3166-4916-a3fb-78e43caab160', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Clothing -> Comfort
    ('a1f18ea1-cbdf-4bf2-9725-9c18e7a53ddc', '478f76fe-0c34-4013-86fa-af93354c296b', '5ed99dba-e49f-4a54-902d-4f32a62338bc', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'), -- Other -> Comfort
    ('5e1dba93-557e-4bf0-bff5-98feba78f307', '478f76fe-0c34-4013-86fa-af93354c296b', '3597c2b5-5d2c-4f6c-800a-674e2e88ee93', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')  -- Restaurants -> Comfort
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 13. BOOTSTRAP HOUSEHOLDS
-- Note: Inserting a household executes trg_household_auto_provision which
-- automatically clones master accounts, templates, categories, and pyramids,
-- and provisions the household-level auxiliar and admin member.
-- ------------------------------------------------------------------------------
INSERT INTO budget.thousehold (
    id, business_type_id, name, currency, status, created_by
) VALUES
    ('22222222-2222-4222-8222-222222222201', 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'Smith Family', 'BOB', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('22222222-2222-4222-8222-222222222202', 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'Chumacero', 'BOB', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 14. BOOTSTRAP HOUSEHOLD MEMBERS
-- Note: Inserting members executes trg_household_member_auto_auxiliar which
-- automatically provisions personal auxiliars for each member.
-- ------------------------------------------------------------------------------
INSERT INTO budget.thousehold_member (
    household_id, user_id, role, member_type, status, created_by
) VALUES
    ('22222222-2222-4222-8222-222222222201', '18598847-ee9d-4638-aee8-ed4d30770664', 'admin', 'mom', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('22222222-2222-4222-8222-222222222201', '88888888-8888-4888-8888-888888888801', 'member', 'dad', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('22222222-2222-4222-8222-222222222202', '6f521862-f9dd-450a-ab69-79de338e2269', 'admin', 'dad', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (household_id, user_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 15. BOOTSTRAP AUXILIARS (Common entity auxiliars for household transactions)
-- ------------------------------------------------------------------------------
INSERT INTO budget.tauxiliar (
    id, auxiliar_type_id, parent_id, household_id, code, name, description, status, created_by
) VALUES
    ('66666666-6666-4666-8666-666666666601', '11ce16ae-62a5-4c3e-8306-8b1b241a9762', null, '22222222-2222-4222-8222-222222222201', 'AUX-COMP', 'Supermercados y Comercios', 'Vendor auxiliar for daily purchases', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('66666666-6666-4666-8666-666666666602', 'f6714980-c452-4d02-afae-5837aedb793a', null, '22222222-2222-4222-8222-222222222201', 'AUX-PERS', 'Miembro Familiar', 'Person auxiliar for family members', 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('66666666-6666-4666-8666-666666666603', '4c49da40-62b2-4b44-9ba9-2e54d0bec78f', null, '22222222-2222-4222-8222-222222222201', 'AUX-INV', 'Fondo Vacaciones', 'Investment auxiliar for family savings', 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO UPDATE SET
    auxiliar_type_id = EXCLUDED.auxiliar_type_id,
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 16. BOOTSTRAP TRANSACTIONS
-- ------------------------------------------------------------------------------
INSERT INTO budget.ttransaction (
    id, household_id, template_transaction_id, transaction_date, operation_code, concept, type, amount, external_reference, source_text, input_data, recorded_via, status, created_by
) VALUES
    (
        '99999999-9999-4999-8999-999999999901',
        '22222222-2222-4222-8222-222222222201',
        '4b2e6d06-5c4e-415e-b889-b550ca35181b',
        now() - interval '2 hours',
        'OP-1001',
        'Jumbo Bilbao',
        'expense',
        64200,
        'Débito Nido',
        'Compra supermercado semanal en Jumbo Bilbao',
        '{"amount": 64200, "category": "Supermarket and Groceries"}'::jsonb,
        'whatsapp',
        'active',
        '18598847-ee9d-4638-aee8-ed4d30770664'
    ),
    (
        '99999999-9999-4999-8999-999999999902',
        '22222222-2222-4222-8222-222222222201',
        '4b2e6d06-5c4e-415e-b889-b550ca35181b',
        now() - interval '4 hours',
        'OP-1002',
        'Farmacias Ahumada',
        'expense',
        12800,
        'Boleta split 50/50',
        'Compra medicamentos recetados',
        '{"amount": 12800, "category": "Health and Pharmacy"}'::jsonb,
        'whatsapp',
        'active',
        '88888888-8888-4888-8888-888888888801'
    ),
    (
        '99999999-9999-4999-8999-999999999903',
        '22222222-2222-4222-8222-222222222201',
        '4b2e6d06-5c4e-415e-b889-b550ca35181b',
        now() - interval '1 day 2 hours',
        'OP-1003',
        'Copec Vitacura',
        'expense',
        32000,
        'Auto familiar',
        'Carga de gasolina tanque lleno',
        '{"amount": 32000, "category": "Transportation and Fuel"}'::jsonb,
        'telegram',
        'active',
        '88888888-8888-4888-8888-888888888801'
    ),
    (
        '99999999-9999-4999-8999-999999999904',
        '22222222-2222-4222-8222-222222222201',
        '4b2e6d06-5c4e-415e-b889-b550ca35181b',
        now() - interval '1 day 5 hours',
        'OP-1004',
        'Netflix Familiar',
        'expense',
        10990,
        'Recurrente',
        'Débito automático suscripción hogar',
        '{"amount": 10990, "category": "Utilities"}'::jsonb,
        'whatsapp',
        'active',
        '6f521862-f9dd-450a-ab69-79de338e2269'
    ),
    (
        '99999999-9999-4999-8999-999999999905',
        '22222222-2222-4222-8222-222222222201',
        '4b2e6d06-5c4e-415e-b889-b550ca35181b',
        now() - interval '3 days',
        'OP-1005',
        'Librería Antártica',
        'expense',
        18500,
        'Escolares',
        'Compra materiales Colegio Mateo',
        '{"amount": 18500, "category": "Education and School"}'::jsonb,
        'whatsapp',
        'active',
        '18598847-ee9d-4638-aee8-ed4d30770664'
    ),
    (
        '99999999-9999-4999-8999-999999999906',
        '22222222-2222-4222-8222-222222222201',
        '4b2e6d06-5c4e-415e-b889-b550ca35181b',
        now() - interval '3 days 4 hours',
        'OP-1006',
        'Ahorro Vacaciones',
        'income',
        150000,
        'Meta Conjunta',
        'Depósito mensual fondo de vacaciones',
        '{"amount": 150000, "category": "Savings and Investments"}'::jsonb,
        'telegram',
        'active',
        '6f521862-f9dd-450a-ab69-79de338e2269'
    )
ON CONFLICT (id) DO UPDATE SET
    template_transaction_id = EXCLUDED.template_transaction_id,
    concept = EXCLUDED.concept,
    amount = EXCLUDED.amount,
    input_data = EXCLUDED.input_data;

-- ------------------------------------------------------------------------------
-- 17. BOOTSTRAP TRANSACTION DETAILS (Double-entry accounting lines)
-- ------------------------------------------------------------------------------
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
    id, transaction_id, account_id, auxiliar_id, budget_type_id, item_code, description, unit_measure_code, quantity, unit_price, debit_base, credit_base, status, created_by
) VALUES
    -- Tx 1: Jumbo Bilbao (64,200) -> Supermarket and Groceries
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '99999999-9999-4999-8999-999999999901', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', 'c9f2530b-c52a-4d4b-81aa-775fffc19fa3', 'ITM-001', 'Debit record - Compra supermercado Jumbo Bilbao', 'unit', 1, 64200, 64200, 0, 'active', '18598847-ee9d-4638-aee8-ed4d30770664'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', '99999999-9999-4999-8999-999999999901', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', 'c9f2530b-c52a-4d4b-81aa-775fffc19fa3', 'ITM-001', 'Credit record - Pago con Cash/Débito', 'unit', 1, 64200, 0, 64200, 'active', '18598847-ee9d-4638-aee8-ed4d30770664'),

    -- Tx 2: Farmacias Ahumada (12,800) -> Health and Pharmacy
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', '99999999-9999-4999-8999-999999999902', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', 'c8a40cf3-f58d-4226-9bf9-71942d497546', 'ITM-002', 'Debit record - Medicamentos Farmacias Ahumada', 'unit', 1, 12800, 12800, 0, 'active', '88888888-8888-4888-8888-888888888801'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', '99999999-9999-4999-8999-999999999902', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', 'c8a40cf3-f58d-4226-9bf9-71942d497546', 'ITM-002', 'Credit record - Pago Cash/Débito', 'unit', 1, 12800, 0, 12800, 'active', '88888888-8888-4888-8888-888888888801'),

    -- Tx 3: Copec Vitacura (32,000) -> Transportation and Fuel
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', '99999999-9999-4999-8999-999999999903', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', '07a56835-b3a0-40ff-ad33-3afaed38f4ae', 'ITM-003', 'Debit record - Combustible Copec Vitacura', 'unit', 1, 32000, 32000, 0, 'active', '88888888-8888-4888-8888-888888888801'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', '99999999-9999-4999-8999-999999999903', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', '07a56835-b3a0-40ff-ad33-3afaed38f4ae', 'ITM-003', 'Credit record - Pago Cash/Débito', 'unit', 1, 32000, 0, 32000, 'active', '88888888-8888-4888-8888-888888888801'),

    -- Tx 4: Netflix Familiar (10,990) -> Utilities
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', '99999999-9999-4999-8999-999999999904', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', '35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b', 'ITM-004', 'Debit record - Suscripción mensual Netflix', 'unit', 1, 10990, 10990, 0, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14', '99999999-9999-4999-8999-999999999904', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', '35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b', 'ITM-004', 'Credit record - Pago automático Cash', 'unit', 1, 10990, 0, 10990, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),

    -- Tx 5: Librería Antártica (18,500) -> Education and School
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05', '99999999-9999-4999-8999-999999999905', 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '66666666-6666-4666-8666-666666666601', '619bcd10-bd18-4635-af69-c62a4ae39018', 'ITM-005', 'Debit record - Materiales escolares Colegio Mateo', 'unit', 1, 18500, 18500, 0, 'active', '18598847-ee9d-4638-aee8-ed4d30770664'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15', '99999999-9999-4999-8999-999999999905', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666601', '619bcd10-bd18-4635-af69-c62a4ae39018', 'ITM-005', 'Credit record - Pago Cash/Débito', 'unit', 1, 18500, 0, 18500, 'active', '18598847-ee9d-4638-aee8-ed4d30770664'),

    -- Tx 6: Ahorro Vacaciones (150,000) -> Savings and Investments & Investments Account (130)
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06', '99999999-9999-4999-8999-999999999906', 'bc54a393-dcf2-4d08-a34b-cab17438af3b', '66666666-6666-4666-8666-666666666603', 'e2c05b09-7bd8-4d65-9421-4715248b2ddf', 'ITM-006', 'Debit record - Depósito en Fondo Vacaciones', 'unit', 1, 150000, 150000, 0, 'active', '6f521862-f9dd-450a-ab69-79de338e2269'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16', '99999999-9999-4999-8999-999999999906', 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '66666666-6666-4666-8666-666666666603', 'e2c05b09-7bd8-4d65-9421-4715248b2ddf', 'ITM-006', 'Credit record - Aporte meta ahorro familiar', 'unit', 1, 150000, 0, 150000, 'active', '6f521862-f9dd-450a-ab69-79de338e2269')
ON CONFLICT (id) DO NOTHING;

