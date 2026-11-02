-- Optional ISO 3166-1 alpha-2 country, confirmed by the household administrator.
-- Existing households remain unknown rather than inferring location from currency.
ALTER TABLE budget.thousehold ADD COLUMN country_code TEXT
 CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
COMMENT ON COLUMN budget.thousehold.country_code IS 'Household country (ISO alpha-2); independent of phone calling code and currency.';
NOTIFY pgrst, 'reload schema';
