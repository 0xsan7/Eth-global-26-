// Typed BriefMint fetch wrapper — Agent B owned, client-safe.
// Mirrors the legacy api-client envelope handling but targets the PROPOSED
// BriefMint routes (PRD §11). Backend 503 means the new service is not
// deployed yet: UI must render `unavailable`, never fixtures as live data.
// 202 = in-progress (execution or chain confirmation); poll, don't assume.
import {
  BRIEFMINT_ROUTES,
  type ApproveBriefRequest,
  type BriefDetailResponse,
  type BriefListResponse,
  type BriefMintConfigResponse,
  type CreateBriefRequest,
  type OpportunityListResponse,
  type PreparePublicationResponse,
  type ReconcilePublicationRequest,
  type SaveDraftRequest,
} from "../shared/briefmint-api";
import type { Hex, PrivateBrief } from "../shared/briefmint";

export { ApiError, isApiError, queryKeys } from "./api-client";
import { ApiError } from "./api-client";

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return "BAD_INPUT";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "QUOTA_EXHAUSTED";
    case 502:
      return "PROVIDER_FAILED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_ERROR";
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function requestBriefmint<T>(path: string, init?: RequestInit): Promise<{ data: T; status: number }> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (e) {
    throw new ApiError(0, "NETWORK_ERROR", e instanceof Error ? e.message : "Network request failed.", true);
  }
  const body = await parseJson(res);
  const ok = res.status >= 200 && res.status < 300;
  if (ok && body && typeof body === "object" && (body as { ok?: unknown }).ok === true) {
    return { data: (body as { data: T }).data, status: res.status };
  }
  const err = body && typeof body === "object" && (body as { ok?: unknown }).ok === false
    ? ((body as { error?: { code?: unknown; message?: unknown; retryable?: unknown } }).error ?? {})
    : {};
  throw new ApiError(
    res.status,
    typeof err.code === "string" ? err.code : codeForStatus(res.status),
    typeof err.message === "string" ? err.message : `Request failed (${res.status}).`,
    typeof err.retryable === "boolean" ? err.retryable : res.status === 502 || res.status === 503 || res.status === 429,
  );
}

async function getBriefmint<T>(path: string): Promise<T> {
  return (await requestBriefmint<T>(path, { method: "GET" })).data;
}

async function postBriefmint<T>(path: string, body?: unknown): Promise<{ data: T; status: number }> {
  return requestBriefmint<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
}

async function putBriefmint<T>(path: string, body?: unknown): Promise<T> {
  return (await requestBriefmint<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) })).data;
}

export type RunBriefResult = { brief: PrivateBrief; pending: boolean };
export type ReconcileBriefResult = { brief: PrivateBrief; pending: boolean };

export const briefmintApi = {
  config(): Promise<BriefMintConfigResponse> {
    return getBriefmint<BriefMintConfigResponse>(BRIEFMINT_ROUTES.config);
  },
  listBriefs(): Promise<BriefListResponse> {
    return getBriefmint<BriefListResponse>(BRIEFMINT_ROUTES.briefs);
  },
  createBrief(req: CreateBriefRequest): Promise<BriefDetailResponse> {
    return postBriefmint<BriefDetailResponse>(BRIEFMINT_ROUTES.briefs, req).then((r) => r.data);
  },
  getBrief(id: string): Promise<BriefDetailResponse> {
    return getBriefmint<BriefDetailResponse>(BRIEFMINT_ROUTES.brief(id));
  },
  async runBrief(id: string): Promise<RunBriefResult> {
    const r = await postBriefmint<PrivateBrief>(BRIEFMINT_ROUTES.run(id), {});
    return { brief: r.data, pending: r.status === 202 };
  },
  saveDraft(id: string, req: SaveDraftRequest): Promise<BriefDetailResponse> {
    return putBriefmint<BriefDetailResponse>(BRIEFMINT_ROUTES.draft(id), req);
  },
  approveBrief(id: string, req: ApproveBriefRequest): Promise<BriefDetailResponse> {
    return postBriefmint<BriefDetailResponse>(BRIEFMINT_ROUTES.approve(id), req).then((r) => r.data);
  },
  preparePublication(id: string): Promise<PreparePublicationResponse> {
    return postBriefmint<PreparePublicationResponse>(BRIEFMINT_ROUTES.preparePublication(id), {}).then((r) => r.data);
  },
  async reconcilePublication(id: string, req: ReconcilePublicationRequest): Promise<ReconcileBriefResult> {
    const r = await postBriefmint<PrivateBrief>(BRIEFMINT_ROUTES.reconcilePublication(id), req);
    return { brief: r.data, pending: r.status === 202 };
  },
  exportBrief(id: string): string {
    return BRIEFMINT_ROUTES.exportBrief(id);
  },
  listOpportunities(): Promise<OpportunityListResponse> {
    return getBriefmint<OpportunityListResponse>(BRIEFMINT_ROUTES.opportunities);
  },
  updateOpportunityServerSide(): Promise<never> {
    // Owner mutations are browser wallet-signed; there is no legacy server
    // mutation endpoint to call. Kept explicit so callers don't invent one.
    throw new ApiError(0, "BAD_INPUT", "Opportunity updates are wallet-signed from the browser.", false);
  },
};

export type { Hex };
