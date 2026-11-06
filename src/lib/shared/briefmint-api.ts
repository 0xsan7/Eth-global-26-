// BriefMint API DTOs — PROPOSED frozen contract v0.1-briefmint-proposed.
// New paths from PRD §11. Legacy /api/jobs routes stay untouched in domain.ts/api.ts.
import type {
  Address,
  BriefMintConfig,
  BriefSummary,
  Hex,
  OpportunityView,
  PrivateBrief,
  PublicParameters,
  PublicPayload,
} from "./briefmint";

export type BriefMintApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };

export type CreateBriefRequest = { notes: string; publicParameters: PublicParameters };
export type RunBriefRequest = Record<string, never>;
export type SaveDraftRequest = { expectedRevision: number; draft: PrivateBrief["editedDraft"] };
export type ApproveBriefRequest = { expectedRevision: number; publicPayloadHash: Hex };
export type PreparePublicationRequest = Record<string, never>;
export type ReconcilePublicationRequest = { txHash?: Hex; entityKey?: Hex };
export type UpdateOpportunityRequest = { title?: string; summary?: string; status?: "open" | "closed" };

export type BriefMintConfigResponse = BriefMintConfig;
export type BriefListResponse = { briefs: BriefSummary[] };
export type BriefDetailResponse = PrivateBrief;
export type PreparePublicationResponse = {
  briefId: string;
  draftRevision: number;
  publicPayload: PublicPayload;
  publicPayloadHash: Hex;
  approvedBy: Address;
  approvedAt: string;
};
export type ReconcilePublicationResponse = PrivateBrief;
export type OpportunityListResponse = { opportunities: OpportunityView[] };

export const BRIEFMINT_ROUTES = {
  config: "/api/briefmint/config",
  briefs: "/api/briefs",
  brief: (id: string) => `/api/briefs/${id}`,
  run: (id: string) => `/api/briefs/${id}/run`,
  draft: (id: string) => `/api/briefs/${id}/draft`,
  approve: (id: string) => `/api/briefs/${id}/approve`,
  preparePublication: (id: string) => `/api/briefs/${id}/publication/prepare`,
  reconcilePublication: (id: string) => `/api/briefs/${id}/publication/reconcile`,
  exportBrief: (id: string) => `/api/briefs/${id}/export`,
  opportunities: "/api/opportunities",
} as const;
