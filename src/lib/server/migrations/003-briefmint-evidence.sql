ALTER TABLE brief_attempts ADD COLUMN original_response TEXT;
ALTER TABLE brief_attempts ADD COLUMN evidence_json TEXT;
CREATE TRIGGER briefs_immutable_identity BEFORE UPDATE OF id,owner,created_at ON briefs
WHEN NEW.id IS NOT OLD.id OR NEW.owner IS NOT OLD.owner OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT,'immutable brief identity'); END;
CREATE TRIGGER brief_approval_immutable BEFORE UPDATE ON brief_approvals
BEGIN SELECT RAISE(ABORT,'immutable brief approval'); END;
CREATE TRIGGER brief_intent_id_immutable BEFORE UPDATE OF intent_id ON brief_publications
WHEN NEW.intent_id IS NOT OLD.intent_id
BEGIN SELECT RAISE(ABORT,'immutable publication identity'); END;
CREATE TRIGGER brief_evidence_immutable BEFORE UPDATE OF original_response,evidence_json ON brief_attempts
WHEN OLD.original_response IS NOT NULL OR OLD.evidence_json IS NOT NULL
BEGIN SELECT RAISE(ABORT,'immutable original provider evidence'); END;
