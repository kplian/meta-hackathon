-- Migration: Create accounts and individual transaction templates for each budget category

DO $$
DECLARE
    v_admin_id UUID := '6f521862-f9dd-450a-ab69-79de338e2269';
    v_expense_type UUID := 'b53ee22b-376c-4391-ade5-9f933af44c19';
    v_income_type UUID := '6b241f01-36a5-4371-abaf-59f1d6a98fbc';
    v_business_type UUID := 'e1d42022-fca8-43f2-a37d-7823372fddb0';
    v_cash_account UUID := 'ee7fc903-bfb0-4332-8395-039fcaabbcd1';
BEGIN
    -- 1. Insert dedicated expense & income accounts if they do not exist
    INSERT INTO budget.taccount (
        id, household_id, account_type_id, parent_id, business_type_id, code, name, currency, requires_auxiliar, is_postable, created_by, status
    ) VALUES
        ('c5300000-0000-4000-8000-000000000530', null, v_expense_type, null, v_business_type, '530', 'Transportation and Fuel', 'BOB', false, true, v_admin_id, 'active'),
        ('c5400000-0000-4000-8000-000000000540', null, v_expense_type, null, v_business_type, '540', 'Utilities', 'BOB', false, true, v_admin_id, 'active'),
        ('c5500000-0000-4000-8000-000000000550', null, v_expense_type, null, v_business_type, '550', 'Housing and Home', 'BOB', false, true, v_admin_id, 'active'),
        ('c5600000-0000-4000-8000-000000000560', null, v_expense_type, null, v_business_type, '560', 'Health and Pharmacy', 'BOB', false, true, v_admin_id, 'active'),
        ('c5700000-0000-4000-8000-000000000570', null, v_expense_type, null, v_business_type, '570', 'Education and School', 'BOB', false, true, v_admin_id, 'active'),
        ('c5800000-0000-4000-8000-000000000580', null, v_expense_type, null, v_business_type, '580', 'Restaurants and Outings', 'BOB', false, true, v_admin_id, 'active'),
        ('c5900000-0000-4000-8000-000000000590', null, v_expense_type, null, v_business_type, '590', 'Clothing and Personal Care', 'BOB', false, true, v_admin_id, 'active'),
        ('c6000000-0000-4000-8000-000000000600', null, v_expense_type, null, v_business_type, '600', 'Pets', 'BOB', false, true, v_admin_id, 'active'),
        ('c6100000-0000-4000-8000-000000000610', null, v_expense_type, null, v_business_type, '610', 'Insurance', 'BOB', false, true, v_admin_id, 'active'),
        ('c6200000-0000-4000-8000-000000000620', null, v_expense_type, null, v_business_type, '620', 'Taxes and Fees', 'BOB', false, true, v_admin_id, 'active'),
        ('c6900000-0000-4000-8000-000000000690', null, v_expense_type, null, v_business_type, '690', 'Other Expenses', 'BOB', false, true, v_admin_id, 'active'),
        ('c4100000-0000-4000-8000-000000000410', null, v_income_type, null, v_business_type, '410', 'Income and Earnings', 'BOB', false, true, v_admin_id, 'active')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert Templates for each category
    INSERT INTO budget.ttemplate_transaction (
        id, business_type_id, household_id, code, name, version, description, input_schema, created_by, status
    ) VALUES
        ('b0010000-0000-4000-8000-000000000001', v_business_type, null, 'tpl_transportation_fuel', 'Transportation and Fuel Template', 1, 'Fuel, transport, taxis', '{}', v_admin_id, 'active'),
        ('b0020000-0000-4000-8000-000000000002', v_business_type, null, 'tpl_debts_loans', 'Debts and Loans Template', 1, 'Debt and loan payments', '{}', v_admin_id, 'active'),
        ('b0030000-0000-4000-8000-000000000003', v_business_type, null, 'tpl_pets', 'Pets Template', 1, 'Pet food and vet expenses', '{}', v_admin_id, 'active'),
        ('b0040000-0000-4000-8000-000000000004', v_business_type, null, 'tpl_taxes_fees', 'Taxes and Fees Template', 1, 'Government taxes, fees, documents', '{}', v_admin_id, 'active'),
        ('b0050000-0000-4000-8000-000000000005', v_business_type, null, 'tpl_restaurants_leisure', 'Restaurants and Outings Template', 1, 'Restaurants, outings, leisure', '{}', v_admin_id, 'active'),
        ('b0060000-0000-4000-8000-000000000006', v_business_type, null, 'tpl_utilities', 'Utilities Template', 1, 'Electricity, water, gas, internet', '{}', v_admin_id, 'active'),
        ('b0070000-0000-4000-8000-000000000007', v_business_type, null, 'tpl_clothing_personal_care', 'Clothing and Personal Care Template', 1, 'Apparel, care, hygiene', '{}', v_admin_id, 'active'),
        ('b0080000-0000-4000-8000-000000000008', v_business_type, null, 'tpl_other', 'Other Expenses Template', 1, 'Miscellaneous and uncategorized', '{}', v_admin_id, 'active'),
        ('b0090000-0000-4000-8000-000000000009', v_business_type, null, 'tpl_children_education', 'Education and School Template', 1, 'School, college, courses, books', '{}', v_admin_id, 'active'),
        ('b0100000-0000-4000-8000-000000000010', v_business_type, null, 'tpl_insurance', 'Insurance Template', 1, 'Health, home, car insurance', '{}', v_admin_id, 'active'),
        ('b0110000-0000-4000-8000-000000000011', v_business_type, null, 'tpl_housing', 'Housing and Home Template', 1, 'Rent, mortgage, house maintenance', '{}', v_admin_id, 'active'),
        ('b0120000-0000-4000-8000-000000000012', v_business_type, null, 'tpl_health_pharmacy', 'Health and Pharmacy Template', 1, 'Pharmacy, doctors, clinics', '{}', v_admin_id, 'active'),
        ('b0140000-0000-4000-8000-000000000014', v_business_type, null, 'tpl_savings_investments', 'Savings and Investments Template', 1, 'Savings allocation, investment funds', '{}', v_admin_id, 'active'),
        ('b0150000-0000-4000-8000-000000000015', v_business_type, null, 'tpl_income_general', 'Income General Template', 1, 'Salary and earnings', '{}', v_admin_id, 'active')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Insert Template Details for each template (Debit: category account, Credit: cash account 110)
    -- Transportation
    INSERT INTO budget.ttemplate_transaction_det (
        id, template_transaction_id, line_number, account_id, side, amount_rule, description_template, created_by, status
    ) VALUES
        ('d0010001-0000-4000-8000-000000000001', 'b0010000-0000-4000-8000-000000000001', 1, 'c5300000-0000-4000-8000-000000000530', 'debit', '{"var": "amount"}', 'Gasto Transporte', v_admin_id, 'active'),
        ('d0010002-0000-4000-8000-000000000002', 'b0010000-0000-4000-8000-000000000001', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),
        
        -- Debts & Loans (520 Interest paid)
        ('d0020001-0000-4000-8000-000000000001', 'b0020000-0000-4000-8000-000000000002', 1, '5ad35085-0238-4f37-b1fe-320b2106abea', 'debit', '{"var": "amount"}', 'Pago Deudas/Préstamos', v_admin_id, 'active'),
        ('d0020002-0000-4000-8000-000000000002', 'b0020000-0000-4000-8000-000000000002', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Pets (600)
        ('d0030001-0000-4000-8000-000000000001', 'b0030000-0000-4000-8000-000000000003', 1, 'c6000000-0000-4000-8000-000000000600', 'debit', '{"var": "amount"}', 'Gasto Mascotas', v_admin_id, 'active'),
        ('d0030002-0000-4000-8000-000000000002', 'b0030000-0000-4000-8000-000000000003', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Taxes & Fees (620)
        ('d0040001-0000-4000-8000-000000000001', 'b0040000-0000-4000-8000-000000000004', 1, 'c6200000-0000-4000-8000-000000000620', 'debit', '{"var": "amount"}', 'Impuestos y Trámites', v_admin_id, 'active'),
        ('d0040002-0000-4000-8000-000000000002', 'b0040000-0000-4000-8000-000000000004', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Restaurants & Outings (580)
        ('d0050001-0000-4000-8000-000000000001', 'b0050000-0000-4000-8000-000000000005', 1, 'c5800000-0000-4000-8000-000000000580', 'debit', '{"var": "amount"}', 'Restaurantes y Salidas', v_admin_id, 'active'),
        ('d0050002-0000-4000-8000-000000000002', 'b0050000-0000-4000-8000-000000000005', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Utilities (540)
        ('d0060001-0000-4000-8000-000000000001', 'b0060000-0000-4000-8000-000000000006', 1, 'c5400000-0000-4000-8000-000000000540', 'debit', '{"var": "amount"}', 'Servicios Básicos', v_admin_id, 'active'),
        ('d0060002-0000-4000-8000-000000000002', 'b0060000-0000-4000-8000-000000000006', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Clothing (590)
        ('d0070001-0000-4000-8000-000000000001', 'b0070000-0000-4000-8000-000000000007', 1, 'c5900000-0000-4000-8000-000000000590', 'debit', '{"var": "amount"}', 'Ropa y Cuidado Personal', v_admin_id, 'active'),
        ('d0070002-0000-4000-8000-000000000002', 'b0070000-0000-4000-8000-000000000007', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Other (690)
        ('d0080001-0000-4000-8000-000000000001', 'b0080000-0000-4000-8000-000000000008', 1, 'c6900000-0000-4000-8000-000000000690', 'debit', '{"var": "amount"}', 'Otros Gastos', v_admin_id, 'active'),
        ('d0080002-0000-4000-8000-000000000002', 'b0080000-0000-4000-8000-000000000008', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Education (570)
        ('d0090001-0000-4000-8000-000000000001', 'b0090000-0000-4000-8000-000000000009', 1, 'c5700000-0000-4000-8000-000000000570', 'debit', '{"var": "amount"}', 'Educación y Colegio', v_admin_id, 'active'),
        ('d0090002-0000-4000-8000-000000000002', 'b0090000-0000-4000-8000-000000000009', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Insurance (610)
        ('d0100001-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000010', 1, 'c6100000-0000-4000-8000-000000000610', 'debit', '{"var": "amount"}', 'Seguros', v_admin_id, 'active'),
        ('d0100002-0000-4000-8000-000000000002', 'b0100000-0000-4000-8000-000000000010', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Housing (550)
        ('d0110001-0000-4000-8000-000000000001', 'b0110000-0000-4000-8000-000000000011', 1, 'c5500000-0000-4000-8000-000000000550', 'debit', '{"var": "amount"}', 'Vivienda y Hogar', v_admin_id, 'active'),
        ('d0110002-0000-4000-8000-000000000002', 'b0110000-0000-4000-8000-000000000011', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Health & Pharmacy (560)
        ('d0120001-0000-4000-8000-000000000001', 'b0120000-0000-4000-8000-000000000012', 1, 'c5600000-0000-4000-8000-000000000560', 'debit', '{"var": "amount"}', 'Salud y Farmacia', v_admin_id, 'active'),
        ('d0120002-0000-4000-8000-000000000002', 'b0120000-0000-4000-8000-000000000012', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Savings & Investments (130 Asset)
        ('d0140001-0000-4000-8000-000000000001', 'b0140000-0000-4000-8000-000000000014', 1, 'bc54a393-dcf2-4d08-a34b-cab17438af3b', 'debit', '{"var": "amount"}', 'Inversión y Ahorro', v_admin_id, 'active'),
        ('d0140002-0000-4000-8000-000000000002', 'b0140000-0000-4000-8000-000000000014', 2, v_cash_account, 'credit', '{"var": "amount"}', 'Pago Efectivo', v_admin_id, 'active'),

        -- Income General (Debit Cash 110, Credit Income 410)
        ('d0150001-0000-4000-8000-000000000001', 'b0150000-0000-4000-8000-000000000015', 1, v_cash_account, 'debit', '{"var": "amount"}', 'Ingreso en Efectivo', v_admin_id, 'active'),
        ('d0150002-0000-4000-8000-000000000002', 'b0150000-0000-4000-8000-000000000015', 2, 'c4100000-0000-4000-8000-000000000410', 'credit', '{"var": "amount"}', 'Ingreso Salarial/Cobro', v_admin_id, 'active')
    ON CONFLICT (id) DO NOTHING;

    -- 4. Assign each category in tbudget_type to its own dedicated template
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
END $$;

