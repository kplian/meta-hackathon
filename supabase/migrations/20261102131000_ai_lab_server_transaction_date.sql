-- The laboratory records messaging transactions at the database server's time.
-- Keep the old date argument for RPC compatibility, but do not trust its value.
DO $migration$
DECLARE
 definition text;
 old_block text := $old$    -- 7. Normalize transaction date
    IF p_transaction_date IS NOT NULL THEN
        IF p_transaction_date = current_date THEN
            v_tx_date := now();
        ELSE
            v_tx_date := (p_transaction_date::text || ' 12:00:00')::timestamptz;
        END IF;
    ELSE
        v_tx_date := now();
    END IF;
$old$;
BEGIN
 definition := pg_get_functiondef('budget.f_register_transaction_ai_lab(text,text,text,text,numeric,text,date,character varying,json,text)'::regprocedure);
 IF position(old_block IN definition)=0 THEN
   RAISE EXCEPTION 'Laboratory date handling changed; review this migration';
 END IF;
 definition := replace(definition,old_block,$new$    -- Messaging date is authoritative server time, never model-supplied.
    v_tx_date := now();
$new$);
 EXECUTE definition;
END;
$migration$;

COMMENT ON FUNCTION budget.f_register_transaction_ai_lab(text,text,text,text,numeric,text,date,character varying,json,text)
IS 'Laboratory backend only. Sender must be verified upstream. Transaction date always uses database now(); legacy date argument is ignored.';
NOTIFY pgrst, 'reload schema';
