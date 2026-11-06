CREATE TABLE briefs (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, view_json TEXT NOT NULL,
 status TEXT NOT NULL, attempts_used INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT, lease_until INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX briefs_owner_created ON briefs(owner,created_at DESC,id DESC);
CREATE TABLE brief_attempts (
 brief_id TEXT NOT NULL REFERENCES briefs(id), number INTEGER NOT NULL,
 lease_token TEXT NOT NULL, status TEXT NOT NULL, lease_until INTEGER NOT NULL,
 error_code TEXT, PRIMARY KEY(brief_id,number)
);
CREATE TABLE brief_quota (
 id INTEGER PRIMARY KEY, owner TEXT NOT NULL, brief_id TEXT NOT NULL REFERENCES briefs(id),
 attempt INTEGER NOT NULL, window_id TEXT NOT NULL, dispatched_at INTEGER NOT NULL,
 UNIQUE(brief_id,attempt)
);
CREATE INDEX brief_quota_window_owner ON brief_quota(window_id,owner);
CREATE TABLE brief_approvals (
 brief_id TEXT NOT NULL REFERENCES briefs(id), revision INTEGER NOT NULL,
 approval_json TEXT NOT NULL, PRIMARY KEY(brief_id,revision)
);
CREATE TABLE brief_publications (
 intent_id TEXT PRIMARY KEY, brief_id TEXT NOT NULL REFERENCES briefs(id),
 request_json TEXT NOT NULL, intent_json TEXT NOT NULL, status TEXT NOT NULL,
 transaction_hash TEXT, entity_key TEXT
);
CREATE UNIQUE INDEX brief_one_pending_intent ON brief_publications(brief_id) WHERE status IN ('prepared','pending');
CREATE TRIGGER briefs_immutable_original
BEFORE UPDATE OF view_json ON briefs
WHEN json_extract(NEW.view_json,'$.id') IS NOT json_extract(OLD.view_json,'$.id')
 OR json_extract(NEW.view_json,'$.ownerAddress') IS NOT json_extract(OLD.view_json,'$.ownerAddress')
 OR json_extract(NEW.view_json,'$.inputSegments') IS NOT json_extract(OLD.view_json,'$.inputSegments')
 OR json_extract(NEW.view_json,'$.publicParameters') IS NOT json_extract(OLD.view_json,'$.publicParameters')
 OR (json_extract(OLD.view_json,'$.immutableModelResult') IS NOT NULL
 AND json_extract(NEW.view_json,'$.immutableModelResult') IS NOT json_extract(OLD.view_json,'$.immutableModelResult'))
BEGIN SELECT RAISE(ABORT,'immutable brief source or model result'); END;
CREATE TRIGGER brief_intent_immutable BEFORE UPDATE OF intent_json,request_json,brief_id ON brief_publications
BEGIN SELECT RAISE(ABORT,'immutable publication intent'); END;
