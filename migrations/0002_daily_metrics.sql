-- Aggregates retain no images, job IDs or IP hashes. Buckets use UTC.
CREATE TABLE IF NOT EXISTS daily_metrics (
  day TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  total_wait_ms INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS count_job_attempt
AFTER INSERT ON jobs
BEGIN
  INSERT INTO daily_metrics(day, attempts)
  VALUES (date(NEW.created_at / 1000, 'unixepoch'), 1)
  ON CONFLICT(day) DO UPDATE SET attempts = attempts + 1;
END;
CREATE TRIGGER IF NOT EXISTS count_job_terminal
AFTER UPDATE OF status ON jobs
WHEN NEW.status IN ('succeeded', 'failed') AND OLD.status NOT IN ('succeeded', 'failed')
BEGIN
  INSERT INTO daily_metrics(day, succeeded, failed, total_wait_ms)
  VALUES (
    date(NEW.created_at / 1000, 'unixepoch'),
    CASE WHEN NEW.status = 'succeeded' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    MAX(0, COALESCE(NEW.completed_at, NEW.created_at) - NEW.created_at)
  )
  ON CONFLICT(day) DO UPDATE SET
    succeeded = succeeded + excluded.succeeded,
    failed = failed + excluded.failed,
    total_wait_ms = total_wait_ms + excluded.total_wait_ms;
END;
