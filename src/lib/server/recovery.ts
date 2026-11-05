import "server-only";
import { randomBytes } from "node:crypto";
import type { Address, JobView } from "../shared/domain";
import { validateTranslations } from "../shared/validation";
import type { Database } from "./db";
import { transaction } from "./db";
import type { InferenceProvider } from "./inference";
import { loadJob, ownedJob, saveJob } from "./jobs";
import { ServiceError } from "./errors";

export function reconcileExpiredLeases(db: Database, now = Date.now()) {
  return transaction(db, () => {
    const rows = db.prepare("SELECT id,lease_token FROM jobs WHERE status='running' AND lease_until<=?").all(now) as { id: string; lease_token: string }[];
    for (const row of rows) {
      const job = loadJob(db, row.id)!;
      job.status = "interrupted"; job.retryEligible = job.attemptsUsed < 2;
      job.error = { code: "EXECUTION_INTERRUPTED", message: "Execution was interrupted. The provider may have processed this attempt." };
      job.updatedAt = new Date(now).toISOString();
      saveJob(db, job);
      db.prepare("UPDATE jobs SET lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").run(row.id, row.lease_token);
      db.prepare("UPDATE attempts SET status='interrupted',error_code='EXECUTION_INTERRUPTED' WHERE job_id=? AND lease_token=? AND status='running'").run(row.id, row.lease_token);
    }
    return rows.length;
  });
}
export class Runner {
  constructor(private db: Database, private provider: InferenceProvider, private timeoutMs: number, private now = Date.now) {}
  async run(buyer: Address, id: string): Promise<{ job: JobView; running: boolean }> {
    reconcileExpiredLeases(this.db, this.now());
    const claim = transaction(this.db, () => {
      const job = ownedJob(this.db, id, buyer);
      if (job.status === "ready") return { job, token: null };
      if (job.payment?.status !== "verified") throw new ServiceError("JOB_NOT_PAID", 409, "Payment must be verified before translation.");
      if (job.status === "running") return { job, token: null };
      if (job.attemptsUsed >= 2 || (job.attemptsUsed > 0 && !job.retryEligible)) throw new ServiceError("RETRY_NOT_ALLOWED", 409, "No translation attempts remain.");
      this.provider.assertReady();
      const token = randomBytes(24).toString("hex");
      const leaseUntil = this.now() + this.timeoutMs + 30_000;
      job.attemptsUsed++; job.retryEligible = false; job.status = "running"; job.error = null; job.updatedAt = new Date(this.now()).toISOString();
      saveJob(this.db, job);
      this.db.prepare("UPDATE jobs SET lease_token=?,lease_until=? WHERE id=?").run(token, leaseUntil, id);
      this.db.prepare("INSERT INTO attempts(job_id,number,lease_token,status,lease_until) VALUES(?,?,?,'running',?)").run(id, job.attemptsUsed, token, leaseUntil);
      return { job, token };
    });
    if (!claim.token) return { job: claim.job, running: claim.job.status === "running" };
    try {
      const result = await this.provider.translate(claim.job.sourceSegments);
      const segments = validateTranslations(result.segments, claim.job.sourceSegments);
      return transaction(this.db, () => {
        this.assertLease(id, claim.token!);
        const job = ownedJob(this.db, id, buyer);
        job.modelSegments = segments; job.evidence = result.evidence; job.status = "ready";
        job.retryEligible = false; job.error = null; job.updatedAt = new Date(this.now()).toISOString();
        saveJob(this.db, job);
        this.db.prepare("UPDATE jobs SET lease_token=NULL,lease_until=NULL WHERE id=?").run(id);
        this.db.prepare("UPDATE attempts SET status='success',evidence_json=? WHERE job_id=? AND lease_token=?").run(JSON.stringify(result.evidence), id, claim.token!);
        return { job, running: false };
      });
    } catch (error) {
      const failure = error instanceof ServiceError ? error : new ServiceError("PROVIDER_FAILED", 502, "Private translation could not be completed.", true);
      let retryEligible = false;
      transaction(this.db, () => {
        const row = this.db.prepare("SELECT lease_token FROM jobs WHERE id=?").get(id) as { lease_token: string | null };
        if (row.lease_token !== claim.token) return;
        const job = ownedJob(this.db, id, buyer);
        job.status = "failed"; job.retryEligible = job.attemptsUsed < 2 && failure.retryable; retryEligible = job.retryEligible; job.error = { code: failure.code, message: failure.message }; job.updatedAt = new Date(this.now()).toISOString();
        saveJob(this.db, job);
        this.db.prepare("UPDATE jobs SET lease_token=NULL,lease_until=NULL WHERE id=?").run(id);
        this.db.prepare("UPDATE attempts SET status='failure',error_code=? WHERE job_id=? AND lease_token=?").run(failure.code, id, claim.token!);
      });
      throw new ServiceError(failure.code, failure.status, failure.message, retryEligible);
    }
  }
  private assertLease(id: string, token: string) {
    const row = this.db.prepare("SELECT lease_token,lease_until FROM jobs WHERE id=?").get(id) as { lease_token: string | null; lease_until: number | null };
    if (row.lease_token !== token || row.lease_until === null || row.lease_until <= this.now()) throw new ServiceError("PROVIDER_FAILED", 502, "Execution ownership expired. Reopen the job to recover.", true);
  }
}
