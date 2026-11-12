CREATE TABLE IF NOT EXISTS multiple_face_jobs (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  children TEXT NOT NULL,
  crops TEXT NOT NULL,
  composing_at INTEGER
);
