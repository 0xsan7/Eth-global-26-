// BriefMint opportunity schema — Agent B (frontend/Arkiv) owned.
// Pure definition only: no React, no wallet, no secrets, no browser globals.
// Namespace is distinct from the legacy translation workshop:
// `tool-city.opportunity.v1` (PRD §14). Str columns hold at most 128 UTF-8
// bytes; larger public text uses bytes columns (up to 128 KiB per value).
import { bool, bytes, defineSchema, str, u64 } from "@arkiv-network/sdk/schema";
import { BRIEFMINT_NAMESPACE } from "@/lib/shared/briefmint";

export const OPPORTUNITY_NAMESPACE = BRIEFMINT_NAMESPACE;

export const OPPORTUNITY_SCHEMA = defineSchema(OPPORTUNITY_NAMESPACE, {
  app: str().indexed(),
  category: str().indexed(),
  language: str().indexed(),
  status: str().indexed(),
  budgetPresent: bool().indexed(),
  budgetCents: u64().indexed(),
  deadline: str().indexed(),
  title: str(),
  summary: bytes(),
  details: bytes(),
  contact: str(),
  revision: u64().indexed(),
});

export type OpportunitySchema = typeof OPPORTUNITY_SCHEMA;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeUtf8(text: string): Uint8Array {
  return textEncoder.encode(text);
}

export function decodeUtf8(value: Uint8Array | string): string {
  if (typeof value === "string") return value;
  return textDecoder.decode(value);
}

export type OpportunityDetailsJson = {
  deliverables: string[];
  acceptanceCriteria: string[];
  exclusions: string[];
  openQuestions: string[];
};

export function encodeDetails(details: OpportunityDetailsJson): Uint8Array {
  const json = JSON.stringify(details);
  // Keep chain payloads small and reviewable; backend enforces the same bound.
  if (encodeUtf8(json).length > 8192) throw new Error("briefmint: public details exceed 8 KiB.");
  return encodeUtf8(json);
}

export function decodeDetails(value: Uint8Array | string): OpportunityDetailsJson {
  const raw = decodeUtf8(value);
  const parsed = JSON.parse(raw) as Partial<OpportunityDetailsJson>;
  const clean = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, 500)) : [];
  return {
    deliverables: clean(parsed.deliverables),
    acceptanceCriteria: clean(parsed.acceptanceCriteria),
    exclusions: clean(parsed.exclusions),
    openQuestions: clean(parsed.openQuestions),
  };
}
