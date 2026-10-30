-- =====================================================================
-- Step 2: Row Level Security (RLS) policies for schema `budget`
-- Allows authenticated users to read and manage records in budget tables
-- =====================================================================

DO $$
DECLARE
    v_table TEXT;
    v_tables TEXT[] := ARRAY[
        'tuser',
        'tbusiness_type',
        'tlanguage',
        'tmessage',
        'tmessage_translation',
        'tchannel',
        'taccount_type',
        'thousehold',
        'tauxiliar_type',
        'tauxiliar',
        'taccount',
        'thousehold_member',
        'thousehold_task',
        'ttemplate_transaction',
        'ttemplate_transaction_det',
        'tbudget_type',
        'tbudget',
        'ttransaction',
        'ttransaction_detail',
        'thousehold_summary',
        'tfinancial_pyramid',
        'tfinancial_pyramid_level',
        'tbudget_type_pyramid_level',
        'tmodel_response',
        'tcommunity',
        'thousehold_community'
    ];
BEGIN
    FOREACH v_table IN ARRAY v_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "authenticated_full_access_%I" ON budget.%I;', v_table, v_table);
        EXECUTE format(
            'CREATE POLICY "authenticated_full_access_%I" ON budget.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
            v_table,
            v_table
        );
    END LOOP;
END;
$$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

