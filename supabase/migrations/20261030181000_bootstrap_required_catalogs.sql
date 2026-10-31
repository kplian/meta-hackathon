-- Bootstrap reference catalogs + legacy chart (partial). Full playbook chart: 20261031140000_playbook_metadata.sql

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

