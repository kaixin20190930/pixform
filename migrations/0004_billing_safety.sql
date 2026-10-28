DROP TRIGGER IF EXISTS credit_revocation_validate;
CREATE TRIGGER credit_revocation_validate
BEFORE INSERT ON credit_revocations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM credit_grants g JOIN billing_accounts b ON b.user_id = g.user_id
    WHERE g.id = NEW.grant_id AND g.user_id = NEW.user_id AND g.bucket = NEW.bucket
      AND g.revoked_at IS NULL AND g.credits = NEW.credits
      AND CASE NEW.bucket WHEN 'subscription' THEN b.subscription_credits ELSE b.permanent_credits END >= NEW.credits
      AND NOT EXISTS (
        SELECT 1 FROM credit_grants newer WHERE newer.user_id=g.user_id AND newer.bucket=g.bucket
          AND newer.created_at>g.created_at AND newer.revoked_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM credit_reservations used WHERE used.user_id=g.user_id
          AND used.state='captured' AND used.created_at>=g.created_at
      )
  ) THEN RAISE(ABORT, 'CREDITS_ALREADY_USED') END;
END;

CREATE TABLE IF NOT EXISTS billing_disputes (
  dispute_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  charge_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS billing_disputes_user_status ON billing_disputes(user_id,status);
