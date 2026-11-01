-- Refresh only the four-area plans; preserve legacy plans and chosen percentages.
DELETE FROM budget.tbudget_type_pyramid_level m
USING budget.tfinancial_pyramid_level l, budget.tfinancial_pyramid p
WHERE m.financial_pyramid_level_id=l.id AND l.financial_pyramid_id=p.id
 AND p.code IN ('essential','balanced','wealth');

INSERT INTO budget.tbudget_type_pyramid_level(financial_pyramid_level_id,budget_type_id)
SELECT l.id,b.id
FROM budget.tfinancial_pyramid p
JOIN budget.tfinancial_pyramid_level l ON l.financial_pyramid_id=p.id
 AND l.status='active' AND l.deleted_at IS NULL
JOIN budget.tbudget_type b ON b.household_id IS NOT DISTINCT FROM p.household_id
 AND (p.household_id IS NOT NULL OR b.business_type_id=p.business_type_id)
 AND b.status='active' AND b.deleted_at IS NULL
WHERE p.code IN ('essential','balanced','wealth') AND p.status='active' AND p.deleted_at IS NULL
 AND l.code=CASE
  WHEN b.category_key='savings_investments' THEN 'saving'
  WHEN b.category_key IN ('debts_loans','taxes_fees','insurance') THEN 'debts'
  WHEN b.category_key IN ('restaurants_leisure','clothing_personal_care','pets','other') THEN 'personal'
  ELSE 'needs'
 END;
