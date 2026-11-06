import "server-only";
import { randomBytes } from "node:crypto";
import { inferenceEvidenceSchema, projectPublicOpportunity, validateModelResult, type BriefView } from "../shared/briefs";
import { getBrief, saveBrief } from "./briefs";
import { transaction, type Database } from "./db";
import { ServiceError, unavailable } from "./errors";
import { reserveBriefQuota, type QuotaPolicy } from "./quota";
import type { BriefInferenceProvider } from "./brief-inference";

export function reconcileExpiredBriefLeases(db: Database, now = Date.now()) {
  return transaction(db, () => {
    const rows = db.prepare("SELECT id,owner,lease_token FROM briefs WHERE status='running' AND lease_until<=?").all(now) as { id: string; owner: string; lease_token: string }[];
    for (const row of rows) {
      const brief = getBrief(db, row.owner, row.id);
      brief.executionStatus = "interrupted"; brief.retryEligible = brief.attemptsUsed < 2;
      brief.error = { code: "EXECUTION_INTERRUPTED", message: "Compilation was interrupted; the dispatched attempt may have been processed.", retryable: brief.retryEligible };
      brief.updatedAt = new Date(now).toISOString(); saveBrief(db, brief);
      db.prepare("UPDATE briefs SET lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").run(row.id, row.lease_token);
      db.prepare("UPDATE brief_attempts SET status='interrupted',error_code='EXECUTION_INTERRUPTED' WHERE brief_id=? AND lease_token=? AND status='running'").run(row.id, row.lease_token);
    }
    return rows.length;
  });
}

export class BriefRunner {
  constructor(private db: Database, private provider: BriefInferenceProvider, private policy: QuotaPolicy | null, private timeoutMs: number, private now = Date.now) {}
  async run(owner: string, id: string): Promise<{ brief: BriefView; running: boolean }> {
    reconcileExpiredBriefLeases(this.db, this.now());
    const claim = transaction(this.db, () => {
      const brief = getBrief(this.db, owner, id);
      if (["ready", "running"].includes(brief.executionStatus)) return { brief, token: null };
      if (brief.attemptsUsed >= 2 || (brief.attemptsUsed > 0 && !brief.retryEligible)) throw new ServiceError("RETRY_NOT_ALLOWED", 409, "No compilation attempts remain.");
      this.provider.assertReady();
      if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 180000) throw unavailable("Invalid compilation timeout.");
      const active = this.db.prepare("SELECT COUNT(*) AS count FROM briefs WHERE status='running'").get() as { count: number };
      if (active.count > 0) throw unavailable("Another compilation is running. Try again shortly.");
      const time = this.now(); const token = randomBytes(24).toString("hex"); const leaseUntil = time + this.timeoutMs + 30000;
      reserveBriefQuota(this.db, this.policy, owner, id, brief.attemptsUsed + 1, time);
      brief.executionStatus = "running"; brief.attemptsUsed++; brief.retryEligible = false; brief.error = null; brief.updatedAt = new Date(time).toISOString();
      saveBrief(this.db, brief);
      this.db.prepare("UPDATE briefs SET lease_token=?,lease_until=? WHERE id=?").run(token, leaseUntil, id);
      this.db.prepare("INSERT INTO brief_attempts(brief_id,number,lease_token,status,lease_until) VALUES(?,?,?,'running',?)").run(id, brief.attemptsUsed, token, leaseUntil);
      return { brief, token };
    });
    if (!claim.token) return { brief: claim.brief, running: claim.brief.executionStatus === "running" };
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new ServiceError("EXECUTION_INTERRUPTED", 503, "Compilation timed out; this dispatched attempt may have been processed.", true));
      }, this.timeoutMs); });
      const output = await Promise.race([this.provider.compile(claim.brief.inputSegments, claim.brief.publicParameters, controller.signal), timeout]);
      const result = validateModelResult(output.result, claim.brief.inputSegments);
      const evidence = inferenceEvidenceSchema.parse(output.evidence);
      if (output.originalResponse !== undefined && (typeof output.originalResponse !== "string"
        || new TextEncoder().encode(output.originalResponse).length > 100000)) throw new Error("Oversized original response");
      if (evidence.routerVerification === false || evidence.independentResponseVerification === "failed" || (evidence.routingTier !== null && evidence.routingTier !== "private")) throw new Error("Contradictory evidence");
      return transaction(this.db, () => {
        this.assertLease(id, claim.token!);
        const brief = getBrief(this.db, owner, id);
        brief.immutableModelResult = result; brief.evidence = evidence; brief.draftRevision++;
        brief.editedDraft = { parameters: brief.publicParameters, status: "open", sections: {
          deliverables: result.deliverables.map(v => v.text), acceptanceCriteria: result.acceptanceCriteria.map(v => v.text),
          exclusions: result.exclusions.map(v => v.text), openQuestions: result.openQuestions.map(v => v.text),
        } };
        projectPublicOpportunity(brief.editedDraft, brief.draftRevision);
        brief.executionStatus = "ready"; brief.retryEligible = false; brief.error = null;
        brief.review = { status: "unreviewed", approval: null }; brief.updatedAt = new Date(this.now()).toISOString(); saveBrief(this.db, brief);
        this.db.prepare("UPDATE briefs SET lease_token=NULL,lease_until=NULL WHERE id=?").run(id);
        this.db.prepare("UPDATE brief_attempts SET status='success',original_response=?,evidence_json=? WHERE brief_id=? AND lease_token=?")
          .run(output.originalResponse ?? null, JSON.stringify(evidence), id, claim.token!);
        return { brief, running: false };
      });
    } catch (error) {
      const failure = error instanceof ServiceError ? error : new ServiceError("PROVIDER_FAILED", 502, "Private brief compilation returned an invalid result.", true);
      let retryEligible = false;
      transaction(this.db, () => {
        const row = this.db.prepare("SELECT lease_token FROM briefs WHERE id=?").get(id) as { lease_token: string | null };
        if (row.lease_token !== claim.token) return;
        const brief = getBrief(this.db, owner, id);
        brief.executionStatus = failure.code === "EXECUTION_INTERRUPTED" ? "interrupted" : "failed";
        brief.retryEligible = brief.attemptsUsed < 2 && failure.retryable; retryEligible = brief.retryEligible;
        brief.error = { code: failure.code, message: failure.message, retryable: retryEligible }; brief.updatedAt = new Date(this.now()).toISOString(); saveBrief(this.db, brief);
        this.db.prepare("UPDATE briefs SET lease_token=NULL,lease_until=NULL WHERE id=?").run(id);
        this.db.prepare("UPDATE brief_attempts SET status=?,error_code=? WHERE brief_id=? AND lease_token=?").run(brief.executionStatus, failure.code, id, claim.token!);
      });
      throw new ServiceError(failure.code, failure.status, failure.message, retryEligible);
    } finally { if (timer) clearTimeout(timer); }
  }
  private assertLease(id: string, token: string) {
    const row = this.db.prepare("SELECT lease_token,lease_until FROM briefs WHERE id=?").get(id) as { lease_token: string | null; lease_until: number | null };
    if (row.lease_token !== token || row.lease_until === null || row.lease_until <= this.now()) throw new ServiceError("EXECUTION_INTERRUPTED", 503, "Compilation lease expired. Reopen the brief to recover.", true);
  }
}
