-- A household remains pending until a member completes its setup explicitly.
ALTER TABLE budget.thousehold
    ADD COLUMN setup_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN budget.thousehold.setup_completed_at IS
    'When household onboarding was completed; NULL means setup is pending.';

NOTIFY pgrst, 'reload schema';
