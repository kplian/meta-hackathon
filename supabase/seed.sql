-- ==============================================================================
-- SEED DATA (Local development test data)
-- Automatically executed by `supabase db reset` (npm run db:reset)
-- ==============================================================================

-- 1. Base Admin User
INSERT INTO budget.tuser (
    id, full_name, email_user, locale, timezone, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by, role
) VALUES 
    ('6f521862-f9dd-450a-ab69-79de338e2269', 'admin', 'admin@kplian.com', 'es', 'UTC', '2026-10-26 22:20:24.7416+00', null, null, null, 'active', null, null, 'admin')
ON CONFLICT (email_user) DO NOTHING;

-- 2. Account Types
INSERT INTO budget.taccount_type (
    id, code, name, normal_balance, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('2d28afba-68fe-4adc-ad2e-0a7525806799', 'equity', 'Equity', 'credit', '2026-10-30 02:40:23.435059+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('640c078c-2165-49b9-a815-8c38d0b25121', 'asset', 'Asset', 'debit', '2026-10-30 02:40:23.435059+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('6b241f01-36a5-4371-abaf-59f1d6a98fbc', 'income', 'Income', 'credit', '2026-10-30 02:40:23.435059+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('b53ee22b-376c-4391-ade5-9f933af44c19', 'expense', 'Expense', 'debit', '2026-10-30 02:40:23.435059+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('fe129378-65f7-423e-a290-5ecc298a0914', 'liability', 'Liability', 'credit', '2026-10-30 02:40:23.435059+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (code) DO NOTHING;

-- 3. Auxiliar Types
INSERT INTO budget.tauxiliar_type (
    id, code, name, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('11ce16ae-62a5-4c3e-8306-8b1b241a9762', 'company', 'Company', '2026-10-30 02:40:28.917159+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('1a3628f0-e518-4536-b731-d97ae6a2b96a', 'loan', 'Loan', '2026-10-30 02:40:28.917159+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('4c49da40-62b2-4b44-9ba9-2e54d0bec78f', 'investment', 'Investment', '2026-10-30 02:40:28.917159+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('b2491c87-f9c3-4672-9877-4c6978822363', 'project', 'Project', '2026-10-30 02:40:28.917159+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('f6714980-c452-4d02-afae-5837aedb793a', 'person', 'Person', '2026-10-30 02:40:28.917159+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (code) DO NOTHING;

-- 4. Business Types
INSERT INTO budget.tbusiness_type (
    id, code, name, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('e1d42022-fca8-43f2-a37d-7823372fddb0', 'household', 'Household', '2026-10-30 02:40:34.236713+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('fdefc1d6-97a7-44f7-bd53-d11bcd5efa0b', 'pyme', 'Small Business', '2026-10-30 02:40:34.236713+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

-- 5. Accounts (Chart of Accounts)
INSERT INTO budget.taccount (
    id, household_id, account_type_id, parent_id, required_auxiliar_type_id, business_type_id, code, name, currency, requires_auxiliar, is_postable, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('1efe291f-49a6-4306-9b79-dd910b36fbcd', null, '640c078c-2165-49b9-a815-8c38d0b25121', null, 'f6714980-c452-4d02-afae-5837aedb793a', 'e1d42022-fca8-43f2-a37d-7823372fddb0', '120', 'Loans receivable', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('5ad35085-0238-4f37-b1fe-320b2106abea', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '520', 'Interest paid', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('8b7dd11f-9bfb-42a3-bfc9-e33a23bb4f3f', null, 'fe129378-65f7-423e-a290-5ecc298a0914', null, '11ce16ae-62a5-4c3e-8306-8b1b241a9762', 'e1d42022-fca8-43f2-a37d-7823372fddb0', '210', 'Loans payable', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('bc54a393-dcf2-4d08-a34b-cab17438af3b', null, '640c078c-2165-49b9-a815-8c38d0b25121', null, '4c49da40-62b2-4b44-9ba9-2e54d0bec78f', 'e1d42022-fca8-43f2-a37d-7823372fddb0', '130', 'Investments', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('d556c3ae-9a60-4c07-8010-234584ea5cf1', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '510', 'Feeding', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('ee7fc903-bfb0-4332-8395-039fcaabbcd1', null, '640c078c-2165-49b9-a815-8c38d0b25121', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '110', 'Cash', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('fce31321-7129-42dc-8e31-6ecda16b9f89', null, '2d28afba-68fe-4adc-ad2e-0a7525806799', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '310', 'Opening balances', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c5300000-0000-4000-8000-000000000530', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '530', 'Transportation and Fuel', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c5400000-0000-4000-8000-000000000540', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '540', 'Utilities', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c5500000-0000-4000-8000-000000000550', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '550', 'Housing and Home', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c5600000-0000-4000-8000-000000000560', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '560', 'Health and Pharmacy', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c5700000-0000-4000-8000-000000000570', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '570', 'Education and School', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c5800000-0000-4000-8000-000000000580', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '580', 'Restaurants and Outings', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c5900000-0000-4000-8000-000000000590', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '590', 'Clothing and Personal Care', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c6000000-0000-4000-8000-000000000600', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '600', 'Pets', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c6100000-0000-4000-8000-000000000610', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '610', 'Insurance', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c6200000-0000-4000-8000-000000000620', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '620', 'Taxes and Fees', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c6900000-0000-4000-8000-000000000690', null, 'b53ee22b-376c-4391-ade5-9f933af44c19', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '690', 'Other Expenses', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c4100000-0000-4000-8000-000000000410', null, '6b241f01-36a5-4371-abaf-59f1d6a98fbc', null, null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', '410', 'Income and Earnings', 'BOB', false, true, '2026-10-30 02:50:48.364056+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

-- 6. Budget Types
INSERT INTO budget.tbudget_type (
    id, household_id, business_type_id, category_key, name, description, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('07a56835-b3a0-40ff-ad33-3afaed38f4ae', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'transportation_fuel', 'Transportation and Fuel', 'Gasoline, budget transportation, taxis, ride-hailing apps', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('22506fa9-03df-4e6a-9d44-c531f7d01c89', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'debts_loans', 'Debts and Loans', 'Loan payments, credit card payments, interest', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('30b93bec-e24a-4001-940a-ecc22033b161', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'pets', 'Pets', 'Pet food, veterinary care, medication, accessories', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('31c7ac4c-0dc7-4d0a-9a3e-7a7f60102353', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'taxes_fees', 'Taxes and Fees', 'Taxes, documents, administrative procedures, fines', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('3597c2b5-5d2c-4f6c-800a-674e2e88ee93', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'restaurants_leisure', 'Restaurants and Outings', 'Restaurants, cafés, bars, family outings, related entertainment', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'utilities', 'Utilities', 'Electricity, water, gas, internet, phone', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('4b501e74-3166-4916-a3fb-78e43caab160', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'clothing_personal_care', 'Clothing and Personal Care', 'Clothing, shoes, haircuts, personal care products', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('5ed99dba-e49f-4a54-902d-4f32a62338bc', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'other', 'Other', 'Expenses that do not fit into another category', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('619bcd10-bd18-4635-af69-c62a4ae39018', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'children_education', 'Education and School', 'Tuition, university, school supplies, books, courses', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('987fb87c-3fde-451e-901a-4d1a64c9b903', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'insurance', 'Insurance', 'Health, vehicle, home, life insurance', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('a2a05b9b-2b43-4fe1-9565-ccf41625fed9', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'housing', 'Housing and Home', 'Rent/mortgage payments, maintenance, repairs', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('c8a40cf3-f58d-4226-9bf9-71942d497546', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'health_pharmacy', 'Health and Pharmacy', 'Medication, medical consultations, doctors, dental care, medical tests', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('c9f2530b-c52a-4d4b-81aa-775fffc19fa3', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'supermarket_groceries', 'Supermarket and Groceries', 'Food for home consumption, beverages, cleaning products, basic hygiene products', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('e2c05b09-7bd8-4d65-9421-4715248b2ddf', null, 'e1d42022-fca8-43f2-a37d-7823372fddb0', 'savings_investments', 'Savings and Investments', 'Monthly savings, investments, emergency fund', '2026-10-30 03:22:24.790467+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

-- 7. Financial Pyramid
INSERT INTO budget.tfinancial_pyramid (
    id, business_type_id, household_id, code, name, description, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('f8505c97-2cac-4184-ad23-72c9d5086b4d', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'basic', 'Basic expenses/incomes', 'Basic expenses/incomes', '2026-10-30 03:52:22.095564+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

-- 8. Financial Pyramid Levels
INSERT INTO budget.tfinancial_pyramid_level (
    id, financial_pyramid_id, code, name, order_by, min_percentage, max_percentage, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('0710f965-b54f-4e91-b219-c41b57e8215b', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '4', 'Experiences', 4, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('1f4f887d-f84d-4b63-b9e8-aaf624923a1f', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '2', 'Security', 2, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('478f76fe-0c34-4013-86fa-af93354c296b', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '3', 'Comfort', 3, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('7118a455-336a-4a92-9552-dd461e84b532', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '1', 'Basic needs', 1, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('e7631ade-d1f8-40bb-b240-daec5f324672', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '5', 'Luxuries', 5, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

-- 9. Budget Type Pyramid Level Mapping
INSERT INTO budget.tbudget_type_pyramid_level (
    id, financial_pyramid_level_id, budget_type_id, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('2b1e021e-c6a0-4903-bb30-4d66e473cfdc', '478f76fe-0c34-4013-86fa-af93354c296b', '4b501e74-3166-4916-a3fb-78e43caab160', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('5e1dba93-557e-4bf0-bff5-98feba78f307', '478f76fe-0c34-4013-86fa-af93354c296b', '3597c2b5-5d2c-4f6c-800a-674e2e88ee93', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('64862ef3-47aa-441e-a921-dcc5edc32857', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', 'e2c05b09-7bd8-4d65-9421-4715248b2ddf', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('66ddfd42-9633-439d-a106-b159e104e58a', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', '619bcd10-bd18-4635-af69-c62a4ae39018', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('7398905c-8cd9-4bde-a59b-cea48b3b3885', '478f76fe-0c34-4013-86fa-af93354c296b', '30b93bec-e24a-4001-940a-ecc22033b161', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('73a7907e-f82a-4048-86be-6be87cc87e51', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', 'c8a40cf3-f58d-4226-9bf9-71942d497546', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('873457ae-f094-4e23-8fdf-b0f6f9febf49', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', '987fb87c-3fde-451e-901a-4d1a64c9b903', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('986230c6-8ee9-41d3-b89e-d9baf93503fe', '7118a455-336a-4a92-9552-dd461e84b532', '35d9aaa4-0dbd-49e6-9bab-a9d256a9cf0b', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('a1f18ea1-cbdf-4bf2-9725-9c18e7a53ddc', '478f76fe-0c34-4013-86fa-af93354c296b', '5ed99dba-e49f-4a54-902d-4f32a62338bc', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('a508f421-1d14-4da0-ac41-78f04c6f3a32', '7118a455-336a-4a92-9552-dd461e84b532', 'c9f2530b-c52a-4d4b-81aa-775fffc19fa3', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b5d1fdba-bd42-4ec2-9f47-c49434c07ccb', '7118a455-336a-4a92-9552-dd461e84b532', '07a56835-b3a0-40ff-ad33-3afaed38f4ae', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('c68c4cd0-2c84-4931-8c24-75c8a8bff3d1', '7118a455-336a-4a92-9552-dd461e84b532', 'a2a05b9b-2b43-4fe1-9565-ccf41625fed9', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('ef49f34e-dc8e-4f38-ad4a-66dfe6ad50a3', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', '31c7ac4c-0dc7-4d0a-9a3e-7a7f60102353', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('fe5562f5-366c-4e49-8689-6230ad7e28b1', '1f4f887d-f84d-4b63-b9e8-aaf624923a1f', '22506fa9-03df-4e6a-9d44-c531f7d01c89', '2026-10-30 04:34:20.94872+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

-- 10. Template Transactions
INSERT INTO budget.ttemplate_transaction (
    id, business_type_id, household_id, code, name, version, description, input_schema, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('4b2e6d06-5c4e-415e-b889-b550ca35181b', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'purchase', 'Purchase', 1, 'Purchase of some stuff', '{}', '2026-10-30 04:43:24.099796+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0010000-0000-4000-8000-000000000001', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_transportation_fuel', 'Transportation and Fuel Template', 1, 'Fuel, transport, taxis', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0020000-0000-4000-8000-000000000002', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_debts_loans', 'Debts and Loans Template', 1, 'Debt and loan payments', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0030000-0000-4000-8000-000000000003', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_pets', 'Pets Template', 1, 'Pet food and vet expenses', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0040000-0000-4000-8000-000000000004', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_taxes_fees', 'Taxes and Fees Template', 1, 'Government taxes, fees, documents', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0050000-0000-4000-8000-000000000005', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_restaurants_leisure', 'Restaurants and Outings Template', 1, 'Restaurants, outings, leisure', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0060000-0000-4000-8000-000000000006', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_utilities', 'Utilities Template', 1, 'Electricity, water, gas, internet', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0070000-0000-4000-8000-000000000007', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_clothing_personal_care', 'Clothing and Personal Care Template', 1, 'Apparel, care, hygiene', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0080000-0000-4000-8000-000000000008', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_other', 'Other Expenses Template', 1, 'Miscellaneous and uncategorized', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0090000-0000-4000-8000-000000000009', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_children_education', 'Education and School Template', 1, 'School, college, courses, books', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0100000-0000-4000-8000-000000000010', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_insurance', 'Insurance Template', 1, 'Health, home, car insurance', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0110000-0000-4000-8000-000000000011', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_housing', 'Housing and Home Template', 1, 'Rent, mortgage, house maintenance', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0120000-0000-4000-8000-000000000012', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_health_pharmacy', 'Health and Pharmacy Template', 1, 'Pharmacy, doctors, clinics', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0140000-0000-4000-8000-000000000014', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_savings_investments', 'Savings and Investments Template', 1, 'Savings allocation, investment funds', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('b0150000-0000-4000-8000-000000000015', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'tpl_income_general', 'Income General Template', 1, 'Salary and earnings', '{}', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

-- 11. Template Transaction Details
INSERT INTO budget.ttemplate_transaction_det (
    id, template_transaction_id, line_number, account_id, account_input_key, side, amount_rule, auxiliar_input_key, item_input_key, repeat_input_key, quantity_input_key, unit_price_input_key, unit_input_key, description_template, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES 
    ('765e2beb-1fad-4ce5-a999-6f077a091260', '4b2e6d06-5c4e-415e-b889-b550ca35181b', 1, 'd556c3ae-9a60-4c07-8010-234584ea5cf1', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Debit record', '2026-10-30 04:56:30.152622+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null), 
    ('f7fdd01e-ece6-4421-997a-b0a5daac8005', '4b2e6d06-5c4e-415e-b889-b550ca35181b', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Credit record', '2026-10-30 04:56:30.152622+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Transportation
    ('d0010001-0000-4000-8000-000000000001', 'b0010000-0000-4000-8000-000000000001', 1, 'c5300000-0000-4000-8000-000000000530', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Gasto Transporte', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0010002-0000-4000-8000-000000000002', 'b0010000-0000-4000-8000-000000000001', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Debts
    ('d0020001-0000-4000-8000-000000000001', 'b0020000-0000-4000-8000-000000000002', 1, '5ad35085-0238-4f37-b1fe-320b2106abea', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Deudas/Préstamos', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0020002-0000-4000-8000-000000000002', 'b0020000-0000-4000-8000-000000000002', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Pets
    ('d0030001-0000-4000-8000-000000000001', 'b0030000-0000-4000-8000-000000000003', 1, 'c6000000-0000-4000-8000-000000000600', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Gasto Mascotas', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0030002-0000-4000-8000-000000000002', 'b0030000-0000-4000-8000-000000000003', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Taxes
    ('d0040001-0000-4000-8000-000000000001', 'b0040000-0000-4000-8000-000000000004', 1, 'c6200000-0000-4000-8000-000000000620', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Impuestos y Trámites', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0040002-0000-4000-8000-000000000002', 'b0040000-0000-4000-8000-000000000004', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Restaurants
    ('d0050001-0000-4000-8000-000000000001', 'b0050000-0000-4000-8000-000000000005', 1, 'c5800000-0000-4000-8000-000000000580', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Restaurantes y Salidas', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0050002-0000-4000-8000-000000000002', 'b0050000-0000-4000-8000-000000000005', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Utilities
    ('d0060001-0000-4000-8000-000000000001', 'b0060000-0000-4000-8000-000000000006', 1, 'c5400000-0000-4000-8000-000000000540', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Servicios Básicos', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0060002-0000-4000-8000-000000000002', 'b0060000-0000-4000-8000-000000000006', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Clothing
    ('d0070001-0000-4000-8000-000000000001', 'b0070000-0000-4000-8000-000000000007', 1, 'c5900000-0000-4000-8000-000000000590', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Ropa y Cuidado Personal', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0070002-0000-4000-8000-000000000002', 'b0070000-0000-4000-8000-000000000007', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Other
    ('d0080001-0000-4000-8000-000000000001', 'b0080000-0000-4000-8000-000000000008', 1, 'c6900000-0000-4000-8000-000000000690', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Otros Gastos', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0080002-0000-4000-8000-000000000002', 'b0080000-0000-4000-8000-000000000008', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Education
    ('d0090001-0000-4000-8000-000000000001', 'b0090000-0000-4000-8000-000000000009', 1, 'c5700000-0000-4000-8000-000000000570', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Educación y Colegio', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0090002-0000-4000-8000-000000000002', 'b0090000-0000-4000-8000-000000000009', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Insurance
    ('d0100001-0000-4000-8000-000000000010', 'b0100000-0000-4000-8000-000000000010', 1, 'c6100000-0000-4000-8000-000000000610', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Seguros', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0100002-0000-4000-8000-000000000010', 'b0100000-0000-4000-8000-000000000010', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Housing
    ('d0110001-0000-4000-8000-000000000011', 'b0110000-0000-4000-8000-000000000011', 1, 'c5500000-0000-4000-8000-000000000550', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Vivienda y Hogar', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0110002-0000-4000-8000-000000000011', 'b0110000-0000-4000-8000-000000000011', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Health
    ('d0120001-0000-4000-8000-000000000012', 'b0120000-0000-4000-8000-000000000012', 1, 'c5600000-0000-4000-8000-000000000560', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Salud y Farmacia', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0120002-0000-4000-8000-000000000012', 'b0120000-0000-4000-8000-000000000012', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Savings
    ('d0140001-0000-4000-8000-000000000014', 'b0140000-0000-4000-8000-000000000014', 1, 'bc54a393-dcf2-4d08-a34b-cab17438af3b', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Inversión y Ahorro', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0140002-0000-4000-8000-000000000014', 'b0140000-0000-4000-8000-000000000014', 2, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Pago Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    -- Income
    ('d0150001-0000-4000-8000-000000000015', 'b0150000-0000-4000-8000-000000000015', 1, 'ee7fc903-bfb0-4332-8395-039fcaabbcd1', '', 'debit', '{"var": "amount"}', null, '', '', '', '', '', 'Ingreso en Efectivo', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('d0150002-0000-4000-8000-000000000002', 'b0150000-0000-4000-8000-000000000015', 2, 'c4100000-0000-4000-8000-000000000410', '', 'credit', '{"var": "amount"}', null, '', '', '', '', '', 'Ingreso Salarial/Cobro', now(), '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

-- Link budget types to their dedicated template transactions
UPDATE budget.tbudget_type SET template_transaction_id = 'b0010000-0000-4000-8000-000000000001' WHERE category_key = 'transportation_fuel';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0020000-0000-4000-8000-000000000002' WHERE category_key = 'debts_loans';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0030000-0000-4000-8000-000000000003' WHERE category_key = 'pets';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0040000-0000-4000-8000-000000000004' WHERE category_key = 'taxes_fees';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0050000-0000-4000-8000-000000000005' WHERE category_key = 'restaurants_leisure';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0060000-0000-4000-8000-000000000006' WHERE category_key = 'utilities';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0070000-0000-4000-8000-000000000007' WHERE category_key = 'clothing_personal_care';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0080000-0000-4000-8000-000000000008' WHERE category_key = 'other';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0090000-0000-4000-8000-000000000009' WHERE category_key = 'children_education';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0100000-0000-4000-8000-000000000010' WHERE category_key = 'insurance';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0110000-0000-4000-8000-000000000011' WHERE category_key = 'housing';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0120000-0000-4000-8000-000000000012' WHERE category_key = 'health_pharmacy';
UPDATE budget.tbudget_type SET template_transaction_id = '4b2e6d06-5c4e-415e-b889-b550ca35181b' WHERE category_key = 'supermarket_groceries';
UPDATE budget.tbudget_type SET template_transaction_id = 'b0140000-0000-4000-8000-000000000014' WHERE category_key = 'savings_investments';
UPDATE budget.tbudget_type SET template_transaction_id = '4b2e6d06-5c4e-415e-b889-b550ca35181b' WHERE template_transaction_id IS NULL;

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

-- 13. Seed Transactions (budget.ttransaction) using your template_transaction_id ('4b2e6d06-5c4e-415e-b889-b550ca35181b')
INSERT INTO budget.ttransaction (
    id, household_id, template_transaction_id, transaction_date, operation_code, concept, type, amount, external_reference, source_text, input_data, recorded_via, created_at, created_by, status
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
        now() - interval '2 hours',
        '18598847-ee9d-4638-aee8-ed4d30770664',
        'active'
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
        now() - interval '4 hours',
        '88888888-8888-4888-8888-888888888801',
        'active'
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
        now() - interval '1 day 2 hours',
        '88888888-8888-4888-8888-888888888801',
        'active'
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
        now() - interval '1 day 5 hours',
        '6f521862-f9dd-450a-ab69-79de338e2269',
        'active'
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
        now() - interval '3 days',
        '18598847-ee9d-4638-aee8-ed4d30770664',
        'active'
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

