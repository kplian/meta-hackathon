CREATE FUNCTION public.f_member_expenses_report(p_household_id UUID,p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=budget,public AS $$
DECLARE h budget.thousehold; result JSONB; start_at TIMESTAMPTZ; end_at TIMESTAMPTZ;
BEGIN
 IF NOT budget.f_is_household_member(p_household_id) THEN RAISE EXCEPTION 'Household access denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 SELECT * INTO STRICT h FROM budget.thousehold WHERE id=p_household_id AND status='active' AND deleted_at IS NULL;
 start_at:=date_trunc('month',now() AT TIME ZONE p_timezone) AT TIME ZONE p_timezone;
 end_at:=(date_trunc('month',now() AT TIME ZONE p_timezone)+interval '1 month') AT TIME ZONE p_timezone;
 WITH tx AS (
 SELECT id,amount FROM budget.ttransaction WHERE household_id=h.id AND ledger_book='operating' AND currency=h.currency
 AND type='expense' AND status='active' AND deleted_at IS NULL AND transaction_date>=start_at AND transaction_date<end_at
 ), member_lines AS (
 -- Count only debit lines; the payment credit is the same expense, not another one.
 SELECT tx.id transaction_id,m.id member_id,u.full_name, sum(d.debit_base) amount
 FROM tx JOIN budget.ttransaction_detail d ON d.transaction_id=tx.id AND d.status='active' AND d.deleted_at IS NULL AND d.debit_base>0
 JOIN budget.thousehold_member m ON m.household_id=h.id AND m.auxiliar_id=d.auxiliar_id
 AND m.status='active' AND m.deleted_at IS NULL
 JOIN budget.tuser u ON u.id=m.user_id
 GROUP BY tx.id,m.id,u.full_name
 ), groups AS (
 SELECT member_id::text id,full_name name,sum(amount) amount,false is_global FROM member_lines GROUP BY member_id,full_name
 UNION ALL
 -- Unassigned lines, other auxiliars and legacy entries without details are global.
 SELECT 'global',NULL,COALESCE(sum(tx.amount-COALESCE(m.amount,0)),0),true
 FROM tx LEFT JOIN (SELECT transaction_id,sum(amount) amount FROM member_lines GROUP BY transaction_id) m ON m.transaction_id=tx.id
 ), total AS (SELECT COALESCE(sum(amount),0) amount FROM tx)
 SELECT jsonb_build_object('currency',trim(h.currency),'total',t.amount,
 'groups',COALESCE((SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object('percentage',CASE WHEN t.amount>0 THEN g.amount/t.amount*100 ELSE 0 END) ORDER BY g.is_global,g.amount DESC,g.id) FROM groups g WHERE g.amount<>0),'[]'::jsonb)) INTO result FROM total t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f_member_expenses_report(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f_member_expenses_report(UUID,TEXT) TO authenticated;
NOTIFY pgrst,'reload schema';
