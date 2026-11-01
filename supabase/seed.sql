-- ==============================================================================
-- SEED DATA (local dev metadata only)
-- Chart of accounts + 38 playbook templates: migration 20261031140000_playbook_metadata.sql
-- This file: admin user, budget categories, pyramid, template routing (no households/transactions)
-- ==============================================================================

-- Admin user (also in bootstrap migration)
INSERT INTO budget.tuser (
    id, full_name, email_user, locale, timezone, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by, role
) VALUES
    ('6f521862-f9dd-450a-ab69-79de338e2269', 'admin', 'admin@kplian.com', 'es', 'UTC', '2026-10-26 22:20:24.7416+00', null, null, null, 'active', null, null, 'admin')
ON CONFLICT (email_user) DO NOTHING;

-- Budget Types (global blueprint)
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

-- Financial Pyramid
INSERT INTO budget.tfinancial_pyramid (
    id, business_type_id, household_id, code, name, description, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES
    ('f8505c97-2cac-4184-ad23-72c9d5086b4d', 'e1d42022-fca8-43f2-a37d-7823372fddb0', null, 'basic', 'Basic expenses/incomes', 'Basic expenses/incomes', '2026-10-30 03:52:22.095564+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO budget.tfinancial_pyramid_level (
    id, financial_pyramid_id, code, name, order_by, min_percentage, max_percentage, created_at, created_by, updated_at, updated_by, status, deleted_at, deleted_by
) VALUES
    ('0710f965-b54f-4e91-b219-c41b57e8215b', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '4', 'Experiences', 4, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('1f4f887d-f84d-4b63-b9e8-aaf624923a1f', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '2', 'Security', 2, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('478f76fe-0c34-4013-86fa-af93354c296b', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '3', 'Comfort', 3, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('7118a455-336a-4a92-9552-dd461e84b532', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '1', 'Basic needs', 1, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null),
    ('e7631ade-d1f8-40bb-b240-daec5f324672', 'f8505c97-2cac-4184-ad23-72c9d5086b4d', '5', 'Luxuries', 5, '20', '20', '2026-10-30 03:58:58.975816+00', '6f521862-f9dd-450a-ab69-79de338e2269', null, null, 'active', null, null)
ON CONFLICT (id) DO NOTHING;

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

-- Link budget categories to playbook templates (stable IDs from playbook metadata migration)
UPDATE budget.tbudget_type SET template_transaction_id = '27abf4b0-2cf9-4279-9f51-0833142e64f9'
WHERE household_id IS NULL AND category_key IN (
    'transportation_fuel', 'supermarket_groceries', 'pets', 'taxes_fees', 'restaurants_leisure',
    'utilities', 'clothing_personal_care', 'other', 'children_education', 'insurance', 'housing', 'health_pharmacy'
);
UPDATE budget.tbudget_type SET template_transaction_id = '8efc3b39-e5ea-48de-9657-c4c54bb25ab0'
WHERE household_id IS NULL AND category_key = 'debts_loans';
UPDATE budget.tbudget_type SET template_transaction_id = 'a0ecb51d-b608-48fb-a5fc-41dc0c150bd1'
WHERE household_id IS NULL AND category_key = 'savings_investments';
