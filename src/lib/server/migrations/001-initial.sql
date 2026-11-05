CREATE TABLE IF NOT EXISTS auth_challenges (
 id TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL,
 expires_at INTEGER NOT NULL, consumed_at INTEGER
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY, address TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
 id TEXT PRIMARY KEY, buyer TEXT NOT NULL, view_json TEXT NOT NULL,
 status TEXT NOT NULL, attempts_used INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT, lease_until INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_buyer_created ON jobs(buyer, created_at DESC);
CREATE TABLE IF NOT EXISTS attempts (
 job_id TEXT NOT NULL REFERENCES jobs(id), number INTEGER NOT NULL,
 lease_token TEXT NOT NULL, status TEXT NOT NULL, lease_until INTEGER NOT NULL,
 evidence_json TEXT, error_code TEXT, PRIMARY KEY(job_id, number)
);
CREATE TABLE IF NOT EXISTS settlements (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id), buyer TEXT NOT NULL,
 view_json TEXT NOT NULL, UNIQUE(buyer, job_id)
);
CREATE TRIGGER IF NOT EXISTS jobs_immutable_quote
BEFORE UPDATE OF view_json ON jobs
WHEN json_extract(NEW.view_json, '$.id') IS NOT json_extract(OLD.view_json, '$.id')
 OR json_extract(NEW.view_json, '$.buyerAddress') IS NOT json_extract(OLD.view_json, '$.buyerAddress')
 OR json_extract(NEW.view_json, '$.workshopEntityKey') IS NOT json_extract(OLD.view_json, '$.workshopEntityKey')
 OR json_extract(NEW.view_json, '$.sourceSegments') IS NOT json_extract(OLD.view_json, '$.sourceSegments')
 OR json_extract(NEW.view_json, '$.terms') IS NOT json_extract(OLD.view_json, '$.terms')
 OR (json_extract(OLD.view_json, '$.modelSegments') IS NOT NULL AND json_extract(NEW.view_json, '$.modelSegments') IS NOT json_extract(OLD.view_json, '$.modelSegments'))
BEGIN SELECT RAISE(ABORT, 'immutable job quote or model output'); END;
