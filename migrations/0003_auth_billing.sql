CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATE NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATE,
  "refreshTokenExpiresAt" DATE,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS billing_accounts (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_key TEXT,
  subscription_status TEXT,
  subscription_credits INTEGER NOT NULL DEFAULT 0 CHECK (subscription_credits >= 0),
  permanent_credits INTEGER NOT NULL DEFAULT 0 CHECK (permanent_credits >= 0),
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  frozen_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('subscription', 'permanent')),
  delta INTEGER NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_time ON credit_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('subscription', 'permanent')),
  source TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  reset_existing INTEGER NOT NULL DEFAULT 0,
  external_ref TEXT NOT NULL UNIQUE,
  expires_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS credit_grants_user_time ON credit_grants(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_revocations (
  external_ref TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('subscription', 'permanent')),
  credits INTEGER NOT NULL CHECK (credits > 0),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS credit_revocation_validate
BEFORE INSERT ON credit_revocations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM credit_grants g JOIN billing_accounts b ON b.user_id = g.user_id
    WHERE g.id = NEW.grant_id AND g.user_id = NEW.user_id AND g.bucket = NEW.bucket
      AND g.revoked_at IS NULL AND g.credits = NEW.credits
      AND CASE NEW.bucket WHEN 'subscription' THEN b.subscription_credits ELSE b.permanent_credits END >= NEW.credits
  ) THEN RAISE(ABORT, 'CREDITS_ALREADY_USED') END;
END;

CREATE TRIGGER IF NOT EXISTS credit_revocation_apply
AFTER INSERT ON credit_revocations
BEGIN
  UPDATE billing_accounts SET subscription_credits = subscription_credits - NEW.credits, updated_at = NEW.created_at
    WHERE user_id = NEW.user_id AND NEW.bucket = 'subscription';
  UPDATE billing_accounts SET permanent_credits = permanent_credits - NEW.credits, updated_at = NEW.created_at
    WHERE user_id = NEW.user_id AND NEW.bucket = 'permanent';
  UPDATE credit_grants SET revoked_at = NEW.created_at WHERE id = NEW.grant_id;
  INSERT INTO credit_ledger (id, user_id, bucket, delta, reason, ref_id, idempotency_key, balance_after, created_at)
  SELECT lower(hex(randomblob(16))), NEW.user_id, NEW.bucket, -NEW.credits, NEW.reason, NEW.external_ref,
    'revoke:' || NEW.external_ref,
    CASE NEW.bucket WHEN 'subscription' THEN subscription_credits ELSE permanent_credits END, NEW.created_at
  FROM billing_accounts WHERE user_id = NEW.user_id;
END;

CREATE TABLE IF NOT EXISTS subscription_expirations (
  external_ref TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits >= 0),
  created_at INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS subscription_expiration_validate
BEFORE INSERT ON subscription_expirations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM billing_accounts WHERE user_id = NEW.user_id AND subscription_credits = NEW.credits
  ) THEN RAISE(ABORT, 'BALANCE_CHANGED') END;
END;

CREATE TRIGGER IF NOT EXISTS subscription_expiration_apply
AFTER INSERT ON subscription_expirations
BEGIN
  INSERT INTO credit_ledger (id, user_id, bucket, delta, reason, ref_id, idempotency_key, balance_after, created_at)
  SELECT lower(hex(randomblob(16))), NEW.user_id, 'subscription', -NEW.credits, 'subscription_expired',
    NEW.external_ref, 'expire:' || NEW.external_ref, 0, NEW.created_at WHERE NEW.credits > 0;
  UPDATE billing_accounts SET subscription_credits = 0, updated_at = NEW.created_at WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS credit_grant_validate
BEFORE INSERT ON credit_grants
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM billing_accounts WHERE user_id = NEW.user_id
  ) THEN RAISE(ABORT, 'BILLING_ACCOUNT_MISSING') END;
END;

CREATE TRIGGER IF NOT EXISTS credit_grant_apply
AFTER INSERT ON credit_grants
BEGIN
  INSERT INTO credit_ledger (id, user_id, bucket, delta, reason, ref_id, idempotency_key, balance_after, created_at)
  SELECT lower(hex(randomblob(16))), NEW.user_id, 'subscription', -subscription_credits,
    'subscription_reset', NEW.external_ref, 'reset:' || NEW.external_ref, 0, NEW.created_at
  FROM billing_accounts
  WHERE user_id = NEW.user_id AND NEW.bucket = 'subscription' AND NEW.reset_existing = 1 AND subscription_credits > 0;

  UPDATE billing_accounts
  SET subscription_credits = 0, updated_at = NEW.created_at
  WHERE user_id = NEW.user_id AND NEW.bucket = 'subscription' AND NEW.reset_existing = 1;

  UPDATE billing_accounts
  SET subscription_credits = subscription_credits + NEW.credits, updated_at = NEW.created_at
  WHERE user_id = NEW.user_id AND NEW.bucket = 'subscription';

  UPDATE billing_accounts
  SET permanent_credits = permanent_credits + NEW.credits, updated_at = NEW.created_at
  WHERE user_id = NEW.user_id AND NEW.bucket = 'permanent';

  INSERT INTO credit_ledger (id, user_id, bucket, delta, reason, ref_id, idempotency_key, balance_after, created_at)
  SELECT lower(hex(randomblob(16))), NEW.user_id, NEW.bucket, NEW.credits, NEW.source,
    NEW.external_ref, 'grant:' || NEW.external_ref,
    CASE NEW.bucket WHEN 'subscription' THEN subscription_credits ELSE permanent_credits END,
    NEW.created_at
  FROM billing_accounts WHERE user_id = NEW.user_id;
END;

CREATE TABLE IF NOT EXISTS credit_reservations (
  job_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  subscription_used INTEGER NOT NULL CHECK (subscription_used >= 0),
  permanent_used INTEGER NOT NULL CHECK (permanent_used >= 0),
  state TEXT NOT NULL CHECK (state IN ('reserved', 'captured', 'released')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  CHECK (subscription_used + permanent_used = credits)
);
CREATE INDEX IF NOT EXISTS credit_reservations_user_time ON credit_reservations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_reservations_state_time ON credit_reservations(state, created_at);

CREATE TRIGGER IF NOT EXISTS credit_reservation_validate
BEFORE INSERT ON credit_reservations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM billing_accounts
    WHERE user_id = NEW.user_id AND frozen_at IS NULL
      AND subscription_credits + permanent_credits >= NEW.credits
      AND NEW.subscription_used = CASE WHEN subscription_credits >= NEW.credits THEN NEW.credits ELSE subscription_credits END
      AND NEW.permanent_used = NEW.credits - NEW.subscription_used
  ) THEN RAISE(ABORT, 'INSUFFICIENT_CREDITS') END;
END;

CREATE TRIGGER IF NOT EXISTS credit_reservation_apply
AFTER INSERT ON credit_reservations
BEGIN
  UPDATE billing_accounts
  SET subscription_credits = subscription_credits - NEW.subscription_used,
      permanent_credits = permanent_credits - NEW.permanent_used,
      updated_at = NEW.created_at
  WHERE user_id = NEW.user_id;

  INSERT INTO credit_ledger (id, user_id, bucket, delta, reason, ref_id, idempotency_key, balance_after, created_at)
  SELECT lower(hex(randomblob(16))), NEW.user_id, 'subscription', -NEW.subscription_used,
    'generation_reserve', NEW.job_id, 'reserve:' || NEW.job_id || ':subscription', subscription_credits, NEW.created_at
  FROM billing_accounts WHERE user_id = NEW.user_id AND NEW.subscription_used > 0;

  INSERT INTO credit_ledger (id, user_id, bucket, delta, reason, ref_id, idempotency_key, balance_after, created_at)
  SELECT lower(hex(randomblob(16))), NEW.user_id, 'permanent', -NEW.permanent_used,
    'generation_reserve', NEW.job_id, 'reserve:' || NEW.job_id || ':permanent', permanent_credits, NEW.created_at
  FROM billing_accounts WHERE user_id = NEW.user_id AND NEW.permanent_used > 0;
END;

CREATE TRIGGER IF NOT EXISTS credit_reservation_release
AFTER UPDATE OF state ON credit_reservations
WHEN OLD.state = 'reserved' AND NEW.state = 'released'
BEGIN
  UPDATE billing_accounts
  SET subscription_credits = subscription_credits + NEW.subscription_used,
      permanent_credits = permanent_credits + NEW.permanent_used,
      updated_at = NEW.resolved_at
  WHERE user_id = NEW.user_id;

  INSERT INTO credit_ledger (id, user_id, bucket, delta, reason, ref_id, idempotency_key, balance_after, created_at)
  SELECT lower(hex(randomblob(16))), NEW.user_id, 'subscription', NEW.subscription_used,
    'generation_release', NEW.job_id, 'release:' || NEW.job_id || ':subscription', subscription_credits, NEW.resolved_at
  FROM billing_accounts WHERE user_id = NEW.user_id AND NEW.subscription_used > 0;

  INSERT INTO credit_ledger (id, user_id, bucket, delta, reason, ref_id, idempotency_key, balance_after, created_at)
  SELECT lower(hex(randomblob(16))), NEW.user_id, 'permanent', NEW.permanent_used,
    'generation_release', NEW.job_id, 'release:' || NEW.job_id || ':permanent', permanent_credits, NEW.resolved_at
  FROM billing_accounts WHERE user_id = NEW.user_id AND NEW.permanent_used > 0;
END;

CREATE TABLE IF NOT EXISTS billing_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  offer_key TEXT NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT UNIQUE,
  stripe_charge_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  paid_at INTEGER,
  refundable_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS billing_orders_user_time ON billing_orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  livemode INTEGER NOT NULL,
  object_id TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS stripe_events_pending ON stripe_events(processed_at, received_at);

ALTER TABLE jobs ADD COLUMN user_id TEXT;
ALTER TABLE jobs ADD COLUMN tool TEXT;
ALTER TABLE jobs ADD COLUMN credits_reserved INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS jobs_user_time ON jobs(user_id, created_at DESC);

