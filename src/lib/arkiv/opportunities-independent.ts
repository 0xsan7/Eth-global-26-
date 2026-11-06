// Independent Arkiv opportunity reader — functions without the BriefMint API.
// Thin wrapper over the canonical adapter (src/lib/arkiv/briefmint/read.ts)
// with explicit access-key configuration supplied by the caller (UI input or
// operator). Never imports private API, session, or wallet code, so public
// discovery keeps working while the application API is stopped. Failed reads
// are distinct from an empty catalogue; no record is ever invented.
import { createArkivBriefmintReader } from "./briefmint/read";
import {
  toOpportunityView,
  type Hex,
  type OpportunityFilters,
  type OpportunityRecord,
  type OpportunityView,
} from "../shared/briefmint";

export const RABDI_PUBLIC_RPC = "https://rpc.rabdi.db-chain.testnet.arkiv.network";
export const RABDI_EXPLORER = "https://rabdi.explorer.arkiv.network";

export type IndependentReaderConfig = { accessKey: string };

function deadlineNowIso(): string {
  return new Date().toISOString();
}

/** Public opportunities without any backend session. Throws sanitized errors only. */
export async function readOpportunitiesIndependent(
  config: IndependentReaderConfig,
  filters: OpportunityFilters = {},
): Promise<OpportunityView[]> {
  const reader = createArkivBriefmintReader({ accessKey: config.accessKey.trim() });
  const base = {
    language: "en" as const,
    deadlineAfter: deadlineNowIso(),
    limit: 50,
    ...(filters.category && filters.category !== "all" ? { category: filters.category } : {}),
  };
  const statuses: Array<"open" | "closed"> =
    filters.status && filters.status !== "all" ? [filters.status] : ["open", "closed"];
  const records: OpportunityRecord[] = [];
  for (const status of statuses) {
    const page = await reader.list({ ...base, status });
    records.push(...page.records);
  }
  const views = records.map(toOpportunityView);
  if (filters.budget === "with") return views.filter((v) => v.budgetUsdCents !== null);
  if (filters.budget === "without") return views.filter((v) => v.budgetUsdCents === null);
  return views;
}

/** Single public opportunity without any backend session; null when absent. */
export async function readOpportunityIndependent(
  config: IndependentReaderConfig,
  entityKey: Hex,
): Promise<OpportunityView | null> {
  const reader = createArkivBriefmintReader({ accessKey: config.accessKey.trim() });
  const record = await reader.get(entityKey);
  return record ? toOpportunityView(record) : null;
}
