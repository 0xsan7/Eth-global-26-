// Independent Arkiv opportunity reader — functions without the BriefMint API.
// This module intentionally imports ONLY the opportunity schema/read layer,
// viem transports, and shared validation. It never imports @/lib/client/*,
// @/lib/server/*, or backend route helpers, so it keeps working while the
// application API is stopped. The RPC URL is supplied explicitly by the caller
// (UI input or script flag), never from a private session.
import type { Hex, OpportunityView } from "@/lib/shared/briefmint";
import {
  getOpportunity,
  listOpportunities,
  type OpportunityFilterInput,
  type OpportunityRpc,
} from "./opportunities-read";

export const RABDI_PUBLIC_RPC = "https://rpc.rabdi.db-chain.testnet.arkiv.network";
export const RABDI_EXPLORER = "https://rabdi.explorer.arkiv.network";

export type IndependentReaderInput = OpportunityRpc & { timeoutMs?: number };

function rpcFrom(input: string | IndependentReaderInput): OpportunityRpc {
  if (typeof input === "string") return { rpcUrl: input };
  const url = input.rpcUrl.trim() || RABDI_PUBLIC_RPC;
  return { rpcUrl: url };
}

/** Public opportunities without any backend session. Throws sanitized errors only. */
export async function readOpportunitiesIndependent(
  rpc: string | IndependentReaderInput,
  filters: OpportunityFilterInput = {},
): Promise<OpportunityView[]> {
  return listOpportunities(rpcFrom(rpc), filters);
}

/** Single public opportunity without any backend session; null when absent. */
export async function readOpportunityIndependent(
  rpc: string | IndependentReaderInput,
  entityKey: Hex,
): Promise<OpportunityView | null> {
  return getOpportunity(rpcFrom(rpc), entityKey);
}
