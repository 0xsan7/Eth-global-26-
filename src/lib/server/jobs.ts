import "server-only";
import { randomBytes } from "node:crypto";
import type { Address, CheckoutTerms, Hex, JobSummary, JobView, PublicConfig, WorkshopView } from "../shared/domain";
import { isHex32, normalizeAddress, validateDraft, validateTranslations } from "../shared/validation";
import type { Database } from "./db";
import { ServiceError, badInput, unavailable } from "./errors";

export type WorkshopReader = (config: PublicConfig, key: Hex) => Promise<WorkshopView | null>;
export type TermsReconciler = (terms: CheckoutTerms) => Promise<void>;
// Replaced only through explicit composition when the teammate's real read adapter is integrated.
export const unavailableWorkshopReader: WorkshopReader = async () => { throw unavailable("The Arkiv discovery adapter is not integrated."); };
export function loadJob(db: Database, id: string): JobView | undefined {
  const row = db.prepare("SELECT view_json FROM jobs WHERE id=?").get(id) as { view_json: string } | undefined;
  return row ? JSON.parse(row.view_json) as JobView : undefined;
}
export function saveJob(db: Database, job: JobView) {
  db.prepare("UPDATE jobs SET view_json=?,status=?,attempts_used=? WHERE id=?").run(JSON.stringify(job), job.status, job.attemptsUsed, job.id);
}
export function ownedJob(db: Database, id: string, buyer: Address): JobView {
  const job = loadJob(db, id);
  if (!job || normalizeAddress(job.buyerAddress) !== normalizeAddress(buyer)) throw new ServiceError("NOT_FOUND", 404, "Job not found.");
  return job;
}
export class JobService {
  constructor(private db: Database, private config: PublicConfig, private readWorkshop: WorkshopReader = unavailableWorkshopReader, private now = Date.now, private reconcileTerms: TermsReconciler = async () => { throw unavailable("Checkout reconciliation is unavailable."); }) {}
  async create(buyer: Address, key: unknown, text: unknown) {
    if (typeof key !== "string" || !isHex32(key) || typeof text !== "string") throw badInput();
    const sourceSegments = validateDraft(text);
    const terms = this.config.terms;
    if (!this.config.configured || !terms) throw unavailable("Checkout is not configured.");
    await this.reconcileTerms(terms);
    let listing: WorkshopView | null;
    try { listing = await this.readWorkshop(this.config, key as Hex); } catch { throw unavailable("Current workshop discovery is unavailable."); }
    if (!listing || listing.entityKey.toLowerCase() !== key.toLowerCase() || !listing.active || listing.freshness !== "fresh" || listing.sourceLang !== "en" || listing.targetLang !== "hi" || listing.jobType !== "text.translate" || normalizeAddress(listing.ownerAddress) !== normalizeAddress(terms.merchantAddress) || listing.checkoutChainId !== terms.chainId || normalizeAddress(listing.checkoutAddress) !== normalizeAddress(terms.checkoutAddress) || listing.serviceId.toLowerCase() !== terms.serviceId.toLowerCase() || listing.termsHash.toLowerCase() !== terms.termsHash.toLowerCase()) throw unavailable("Workshop does not match the configured service.");
    const timestamp = new Date(this.now()).toISOString();
    const job: JobView = { id: `0x${randomBytes(32).toString("hex")}`, buyerAddress: normalizeAddress(buyer), workshopEntityKey: key as Hex, sourceLang: "en", targetLang: "hi", status: "awaiting_payment", sourceSegments, terms: structuredClone(terms), payment: null, modelSegments: null, editedSegments: null, evidence: null, attemptsUsed: 0, retryEligible: false, error: null, createdAt: timestamp, updatedAt: timestamp };
    this.db.prepare("INSERT INTO jobs(id,buyer,view_json,status,created_at) VALUES(?,?,?,?,?)").run(job.id, job.buyerAddress, JSON.stringify(job), job.status, timestamp);
    return job;
  }
  get(buyer: Address, id: string) { return ownedJob(this.db, id, buyer); }
  list(buyer: Address): JobSummary[] {
    const rows = this.db.prepare("SELECT view_json FROM jobs WHERE buyer=? ORDER BY created_at DESC,id DESC").all(normalizeAddress(buyer)) as { view_json: string }[];
    return rows.map(row => { const j = JSON.parse(row.view_json) as JobView; return { id: j.id, status: j.status, createdAt: j.createdAt, updatedAt: j.updatedAt, sourceLang: j.sourceLang, targetLang: j.targetLang }; });
  }
  edits(buyer: Address, id: string, segments: unknown) {
    const job = this.get(buyer, id);
    if (job.status !== "ready") throw new ServiceError("JOB_NOT_READY", 409, "Job is not ready for edits.");
    job.editedSegments = validateTranslations(segments, job.sourceSegments);
    job.updatedAt = new Date(this.now()).toISOString();
    saveJob(this.db, job);
    return job;
  }
}
