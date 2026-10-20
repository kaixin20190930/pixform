CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  prediction_id TEXT,
  status TEXT NOT NULL,
  style TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  expires_at INTEGER NOT NULL,
  output_key TEXT,
  output_type TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS jobs_expiry ON jobs(expires_at);
CREATE TABLE IF NOT EXISTS usage (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_window ON usage(ip_hash, created_at);
