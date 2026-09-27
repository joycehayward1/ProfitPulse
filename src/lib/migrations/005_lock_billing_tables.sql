-- Billing tables are written only by server routes (admin key). Users can
-- read their own rows but no longer insert/update/delete them — previously a
-- signed-in user could set their own subscription to active Pro.
-- Also adds the missing DELETE policy the Data page needs to remove a month.
-- Applied to production 2026-09-27.

DROP POLICY IF EXISTS subscriptions_insert_own ON subscriptions;
DROP POLICY IF EXISTS subscriptions_update_own ON subscriptions;
DROP POLICY IF EXISTS subscriptions_delete_own ON subscriptions;
DROP POLICY IF EXISTS payment_records_insert_own ON payment_records;

CREATE POLICY "Users can delete own snapshots" ON financial_snapshots
  FOR DELETE USING (user_id = (auth.uid())::text);
