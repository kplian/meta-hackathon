-- Expected income sources are planning data, separate from received transactions.
ALTER TABLE budget.thousehold_member
    ADD CONSTRAINT thousehold_member_household_id_id_key UNIQUE (household_id, id);

CREATE TABLE budget.tincome_source (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES budget.thousehold(id) ON DELETE CASCADE,
    household_member_id UUID,
    name VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
    estimated_amount NUMERIC NOT NULL CHECK (estimated_amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'BOB' CHECK (length(trim(currency)) > 0),
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly'
        CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly', 'variable')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID DEFAULT auth.uid() REFERENCES budget.tuser(id),
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES budget.tuser(id),
    status VARCHAR(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES budget.tuser(id),
    -- An optional recipient must belong to this exact household.
    CONSTRAINT tincome_source_household_member_fkey
        FOREIGN KEY (household_id, household_member_id)
        REFERENCES budget.thousehold_member(household_id, id)
);
COMMENT ON TABLE budget.tincome_source IS
    'Estimated household income sources; never represents money already received.';
COMMENT ON COLUMN budget.tincome_source.household_member_id IS
    'NULL for shared household income, otherwise the recipient membership in this household.';
COMMENT ON COLUMN budget.tincome_source.estimated_amount IS
    'Estimated income per frequency period; variable amounts are estimates without a fixed period.';

CREATE INDEX tincome_source_household_id_idx ON budget.tincome_source(household_id);
CREATE INDEX tincome_source_household_member_id_idx ON budget.tincome_source(household_member_id);
ALTER TABLE budget.tincome_source ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON budget.tincome_source TO authenticated, service_role;

CREATE POLICY income_sources_read ON budget.tincome_source
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM budget.thousehold_member m
        WHERE m.household_id = tincome_source.household_id AND m.user_id = auth.uid()
          AND m.status = 'active' AND m.deleted_at IS NULL
    ));
CREATE POLICY income_sources_manage ON budget.tincome_source
    FOR ALL TO authenticated USING (EXISTS (
        SELECT 1 FROM budget.thousehold_member m
        WHERE m.household_id = tincome_source.household_id AND m.user_id = auth.uid()
          AND m.role = 'admin' AND m.status = 'active' AND m.deleted_at IS NULL
    )) WITH CHECK (EXISTS (
        SELECT 1 FROM budget.thousehold_member m
        WHERE m.household_id = tincome_source.household_id AND m.user_id = auth.uid()
          AND m.role = 'admin' AND m.status = 'active' AND m.deleted_at IS NULL
    ));
NOTIFY pgrst, 'reload schema';
