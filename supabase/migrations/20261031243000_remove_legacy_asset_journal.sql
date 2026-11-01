-- Refuse removal if any legacy posting is missing from the common journal.
DO $$ BEGIN
 IF EXISTS(
  SELECT 1 FROM budget.tasset_entry e
  JOIN budget.tasset_position p ON p.id=e.position_id
  WHERE NOT EXISTS(
   SELECT 1 FROM budget.ttransaction t JOIN budget.ttransaction_detail d ON d.transaction_id=t.id
   WHERE t.id=p.opening_transaction_id AND t.household_id=e.household_id
    AND t.ledger_book='patrimony' AND t.currency=e.currency AND t.type='opening_balance'
    AND d.account_id=e.account_id AND d.auxiliar_id=e.auxiliar_id
    AND d.debit_base=CASE WHEN e.side='debit' THEN e.amount_usd ELSE 0 END
    AND d.credit_base=CASE WHEN e.side='credit' THEN e.amount_usd ELSE 0 END
  )
 ) THEN RAISE EXCEPTION 'Legacy asset postings must be fully migrated before removing their table'; END IF;
END; $$;
DROP TABLE budget.tasset_entry;
DROP FUNCTION budget.f_legacy_asset_journal_readonly();
NOTIFY pgrst,'reload schema';
