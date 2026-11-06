// BriefMint shared DTOs — PROPOSED frozen contract v0.1-briefmint-proposed.
// Derived from BriefMint-PRD.md §§9–11. Client-safe: no server imports, no secrets.
// Status: PROPOSED — pending San/backend-agent confirmation. Frontend implements
// against this file so both sides share one source; do not widen these types
// independently. Legacy translation DTOs in domain.ts are preserved untouched.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export const BRIEFMINT_NAMESPACE = "tool-city.opportunity.v1" as const;
export const BRIEFMINT_SCHEMA_VERSION = 1 as const;
export const BRIEFMINT_KIND = "brief.compile.v1" as const;

export type BriefCategory = "writing" | "design";
export type OpportunityStatus = "open" | "closed";
export type ExecutionStatus = "draft" | "running" | "ready" | "failed" | "interrupted";
export type ReviewStatus = "unreviewed" | "approved";
export type PublicationStatus = "unpublished" | "pending" | "live" | "closed" | "expired";
export type BriefFreshness = "fresh" | "stale" | "unavailable";

export interface InputSegment {
  id: string;
  text: string;
}

export interface PublicParameters {
  category: BriefCategory;
  title: string;
  summary: string;
  budgetCentsPresent: boolean;
  /** Integer USD cents, explicitly unfunded. Present only when budgetCentsPresent. */
  budgetCents: number | null;
  /** Optional HTTPS contact URL supplied deliberately by the owner. */
  contactUrl: string | null;
  /** Future UTC deadline ISO string; app-level max 7 days, subject to chain expiry. */
  deadline: string;
  language: "en";
}

export interface BriefSectionItem {
  id: string;
  text: string;
  sourceRefs: string[];
}

export interface ModelBriefResult {
  deliverables: BriefSectionItem[];
  acceptanceCriteria: BriefSectionItem[];
  exclusions: BriefSectionItem[];
  openQuestions: BriefSectionItem[];
}

/** Exact public allowlist — nothing outside these fields may be published. */
export interface PublicPayload {
  title: string;
  summary: string;
  category: BriefCategory;
  language: "en";
  deliverables: string[];
  acceptanceCriteria: string[];
  exclusions: string[];
  openQuestions: string[];
  budgetCents: number | null;
  contactUrl: string | null;
  deadline: string;
  revision: number;
  schemaVersion: 1;
}

export interface BriefApproval {
  briefId: string;
  draftRevision: number;
  canonicalPublicPayload: PublicPayload;
  publicPayloadHash: Hex;
  approvedBy: Address;
  approvedAt: string;
}

export interface BriefPublicationState {
  briefId: string;
  entityKey: Hex | null;
  publicRevision: number | null;
  pendingTxHash: Hex | null;
  lastConfirmedTxHash: Hex | null;
  observedPayloadHash: Hex | null;
  expiresAtBlock: string | null;
  lastObservedStatus: PublicationStatus;
  observedAt: string | null;
  freshness: BriefFreshness;
}

export interface BriefInferenceEvidence {
  requestId: string | null;
  modelId: string | null;
  providerId: string | null;
  routingTier: string | null;
  verificationRequested: boolean;
  routerTeeVerified: boolean | null;
  /** Independent verification is a separate check; null = not performed. */
  independentVerified: boolean | null;
  checkedAt: string | null;
}

export interface PrivateBrief {
  id: string;
  ownerAddress: Address;
  inputSegments: InputSegment[];
  publicParameters: PublicParameters;
  executionStatus: ExecutionStatus;
  reviewStatus: ReviewStatus;
  attemptsUsed: number;
  retryEligible: boolean;
  /** Immutable model output; never overwritten by edits. */
  immutableModelResult: ModelBriefResult | null;
  /** Owner-edited candidate with optimistic-concurrency revision. */
  editedDraft: ModelBriefResult | null;
  draftRevision: number;
  approval: BriefApproval | null;
  publication: BriefPublicationState;
  inferenceEvidence: BriefInferenceEvidence | null;
  error: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type BriefSummary = Pick<
  PrivateBrief,
  "id" | "executionStatus" | "reviewStatus" | "draftRevision" | "createdAt" | "updatedAt"
> & {
  title: string;
  category: BriefCategory;
};

/** Arkiv-backed public opportunity projection (system owner/expiry included). */
export interface OpportunityView {
  entityKey: Hex;
  ownerAddress: Address;
  title: string;
  summary: string;
  category: BriefCategory;
  language: "en";
  status: OpportunityStatus;
  budgetCents: number | null;
  contactUrl: string | null;
  deadline: string;
  revision: number;
  expiresAtBlock: string | null;
  fetchedAt: string;
  freshness: BriefFreshness;
}

export interface OpportunityFilters {
  category?: BriefCategory | "all";
  language?: "en" | "all";
  status?: OpportunityStatus | "all";
  budgetPresent?: boolean | "all";
  query?: string;
}

export interface BriefMintConfig {
  schemaVersion: 1;
  ready: boolean;
  namespace: typeof BRIEFMINT_NAMESPACE;
  authReady: boolean;
  compilationReady: boolean;
  arkivReady: boolean;
  maxWords: number;
  maxChars: number;
  maxSegments: number;
  maxPublicTitleBytes: number;
  maxPublicSummaryChars: number;
  maxDeadlineDays: number;
  quota: {
    newBriefsPerWallet: number | null;
    retriesPerBrief: number;
    globalDispatchLimit: number | null;
    note: string;
  };
  arkiv: { chainId: number; rpcUrl: string; explorerUrl: string };
  model: { id: string | null; privateOnly: boolean };
  termsNote: string;
}
