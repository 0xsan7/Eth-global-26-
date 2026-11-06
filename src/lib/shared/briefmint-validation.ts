// BriefMint canonical payload + validation — client-safe, no server imports.
// Companion to briefmint.ts. Canonical JSON uses sorted keys and exact array
// order so approval hashes are stable; hash via keccak256 of UTF-8 bytes.
import { keccak256, stringToHex } from "viem";
import type {
  Address,
  BriefCategory,
  Hex,
  ModelBriefResult,
  OpportunityView,
  PrivateBrief,
  PublicParameters,
  PublicPayload,
} from "./briefmint";

export const MAX_BRIEF_WORDS = 250;
export const MAX_BRIEF_CHARS = 5000;
export const MAX_BRIEF_SEGMENTS = 20;
export const MAX_TITLE_BYTES = 100;
export const MAX_SUMMARY_CHARS = 280;
export const MAX_SECTION_ITEMS = 20;
export const MAX_SECTION_TEXT_CHARS = 500;
export const MAX_DEADLINE_DAYS = 7;

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function splitBriefSegments(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_BRIEF_SEGMENTS);
}

export function briefSegmentIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `seg_${String(i + 1).padStart(3, "0")}`);
}

export type BriefInputError = { ok: false; code: string; message: string };

export function validateBriefNotes(text: string): { ok: true } | BriefInputError {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, code: "BAD_INPUT", message: "Private notes are empty." };
  if (trimmed.length > MAX_BRIEF_CHARS)
    return { ok: false, code: "BAD_INPUT", message: `Notes exceed ${MAX_BRIEF_CHARS} characters.` };
  if (countWords(trimmed) > MAX_BRIEF_WORDS)
    return { ok: false, code: "BAD_INPUT", message: `Notes exceed ${MAX_BRIEF_WORDS} words.` };
  return { ok: true };
}

function isFutureIso(value: string): boolean {
  const t = Date.parse(value);
  return Number.isFinite(t) && t > Date.now();
}

function deadlineTooFar(value: string): boolean {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return true;
  return t - Date.now() > MAX_DEADLINE_DAYS * 24 * 60 * 60 * 1000 + 60_000;
}

export function validatePublicParameters(p: PublicParameters): { ok: true } | BriefInputError {
  if (p.category !== "writing" && p.category !== "design")
    return { ok: false, code: "BAD_INPUT", message: "Category must be writing or design." };
  if (p.language !== "en") return { ok: false, code: "BAD_INPUT", message: "Language must be en." };
  if (!p.title.trim() || utf8Bytes(p.title.trim()) > MAX_TITLE_BYTES)
    return { ok: false, code: "BAD_INPUT", message: `Title is required within ${MAX_TITLE_BYTES} UTF-8 bytes.` };
  if (!p.summary.trim() || p.summary.trim().length > MAX_SUMMARY_CHARS)
    return { ok: false, code: "BAD_INPUT", message: `Summary is required within ${MAX_SUMMARY_CHARS} characters.` };
  if (p.budgetCentsPresent) {
    if (p.budgetCents === null || !Number.isSafeInteger(p.budgetCents) || p.budgetCents < 0)
      return { ok: false, code: "BAD_INPUT", message: "Advertised budget must be a non-negative integer cents value." };
  } else if (p.budgetCents !== null) {
    return { ok: false, code: "BAD_INPUT", message: "Budget must be absent when not advertised." };
  }
  if (p.contactUrl !== null) {
    try {
      const u = new URL(p.contactUrl);
      if (u.protocol !== "https:") throw new Error("contact must be https");
    } catch {
      return { ok: false, code: "BAD_INPUT", message: "Contact URL must be a valid https URL." };
    }
  }
  if (!isFutureIso(p.deadline)) return { ok: false, code: "BAD_INPUT", message: "Deadline must be a future UTC timestamp." };
  if (deadlineTooFar(p.deadline))
    return { ok: false, code: "BAD_INPUT", message: `Deadline is at most ${MAX_DEADLINE_DAYS} days ahead.` };
  return { ok: true };
}

function cleanItems(items: ModelBriefResult["deliverables"]): string[] {
  return items.map((i) => i.text.trim()).filter(Boolean);
}

/** Build the exact public allowlist from the saved edited draft (never private notes). */
export function projectPublicPayload(brief: PrivateBrief): PublicPayload {
  const draft = brief.editedDraft ?? brief.immutableModelResult;
  if (!draft) throw new Error("briefmint: no saved result to project.");
  return {
    title: brief.publicParameters.title.trim(),
    summary: brief.publicParameters.summary.trim(),
    category: brief.publicParameters.category,
    language: "en",
    deliverables: cleanItems(draft.deliverables),
    acceptanceCriteria: cleanItems(draft.acceptanceCriteria),
    exclusions: cleanItems(draft.exclusions),
    openQuestions: cleanItems(draft.openQuestions),
    budgetCents: brief.publicParameters.budgetCentsPresent ? brief.publicParameters.budgetCents : null,
    contactUrl: brief.publicParameters.contactUrl,
    deadline: brief.publicParameters.deadline,
    revision: brief.draftRevision,
    schemaVersion: 1,
  };
}

/** Stable canonical JSON: sorted object keys, preserved array order. */
export function canonicalizePublicPayload(payload: PublicPayload): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sort((v as Record<string, unknown>)[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(payload));
}

export function hashPublicPayload(payload: PublicPayload): Hex {
  return keccak256(stringToHex(canonicalizePublicPayload(payload)));
}

/** Approval is valid only for the exact saved revision and recomputed hash. */
export function isApprovalCurrent(brief: PrivateBrief): boolean {
  if (!brief.approval || brief.reviewStatus !== "approved") return false;
  if (brief.approval.draftRevision !== brief.draftRevision) return false;
  try {
    return (
      brief.approval.publicPayloadHash.toLowerCase() ===
      hashPublicPayload(projectPublicPayload(brief)).toLowerCase()
    );
  } catch {
    return false;
  }
}

/** Guard: public projection must never contain private fields, even with hostile text. */
export function assertPublicPayloadClean(payload: PublicPayload): void {
  const blob = canonicalizePublicPayload(payload);
  void blob;
  const forbiddenKeys = [
    "inputSegments",
    "ownerAddress",
    "privateBrief",
    "database",
    "session",
    "credential",
    "privateKey",
    "sourceRefs",
    "sourceIds",
  ];
  const keys = Object.keys(payload);
  for (const k of forbiddenKeys) {
    if (keys.includes(k)) throw new Error(`briefmint: public payload contains private field ${k}.`);
  }
  // Source IDs/notes must not leak through section text: the projection carries
  // plain strings only; sourceRefs stay private on the brief record.
  if (payload.schemaVersion !== 1) throw new Error("briefmint: unknown public schema version.");
}

export function categoryLabel(c: BriefCategory): string {
  return c === "writing" ? "Writing" : "Design";
}

/** Client-side filter for indexed opportunity discovery (mirrors server semantics). */
export function filterOpportunities(
  list: OpportunityView[],
  f: { category?: string; status?: string; budgetPresent?: string; query?: string },
): OpportunityView[] {
  return list.filter((o) => {
    if (f.category && f.category !== "all" && o.category !== f.category) return false;
    if (f.status && f.status !== "all" && o.status !== f.status) return false;
    if (f.budgetPresent === "with" && o.budgetCents === null) return false;
    if (f.budgetPresent === "without" && o.budgetCents !== null) return false;
    if (f.query && f.query.trim()) {
      const q = f.query.trim().toLowerCase();
      const hay = `${o.title}\n${o.summary}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type { Address };
