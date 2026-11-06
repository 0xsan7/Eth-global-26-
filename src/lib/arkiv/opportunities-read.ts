// Server-neutral BriefMint opportunity reads — Agent B owned.
// No React hooks, no wallet state, no browser globals, no secrets, no imports
// from write modules or the private backend, so server code can reuse this
// module and the independent reader stays backend-free.
//
// Normalization mirrors the legacy workshop reader:
// - missing record -> null (NoEntityFoundError / SchemaMismatchError)
// - network/query failure -> sanitized Error (RPC payloads can embed endpoints)
import {
  NoEntityFoundError,
  SchemaMismatchError,
  createPublicClient,
  type Expression,
  type FullRow,
} from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, eq } from "@arkiv-network/sdk/query";
import { http } from "viem";
import type { Address, BriefCategory, Hex, OpportunityStatus, OpportunityView } from "@/lib/shared/briefmint";
import { isAddress } from "@/lib/shared/validation";
import {
  OPPORTUNITY_NAMESPACE,
  OPPORTUNITY_SCHEMA,
  decodeDetails,
  decodeUtf8,
  type OpportunitySchema,
} from "./opportunity-schema";

export const OPPORTUNITY_LIST_LIMIT = 100;

export type OpportunityRpc = { rpcUrl: string };
export type OpportunityFilterInput = {
  category?: BriefCategory | "all";
  language?: "en" | "all";
  status?: OpportunityStatus | "all";
  budgetPresent?: boolean | "all";
};

type OpportunityRow = FullRow<OpportunitySchema>;

function isHexKey(v: unknown): v is Hex {
  return typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
}

export function publicClientForOpportunities(rpc: OpportunityRpc) {
  const rpcUrl = rpc.rpcUrl.trim();
  return createPublicClient({
    chain: rabdi({ accessKey: "" }),
    transport: http(rpcUrl.length > 0 ? rpcUrl : undefined),
  });
}

function toStringValue(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function toOpportunityView(row: OpportunityRow, fetchedAt: string): OpportunityView | null {
  if (!isHexKey(row.$key) || !isAddress(row.$owner)) return null;
  if (row.app.value !== OPPORTUNITY_NAMESPACE) return null;
  const category = toStringValue(row.category.value);
  const language = toStringValue(row.language.value);
  const status = toStringValue(row.status.value);
  if ((category !== "writing" && category !== "design") || language !== "en") return null;
  if (status !== "open" && status !== "closed") return null;
  const title = toStringValue(row.title.value);
  if (!title) return null;
  let summary = "";
  let details = { deliverables: [], acceptanceCriteria: [], exclusions: [], openQuestions: [] } as ReturnType<typeof decodeDetails>;
  try {
    summary = decodeUtf8(row.summary.value as Uint8Array | string).slice(0, 2000);
    details = decodeDetails(row.details.value as Uint8Array | string);
  } catch {
    return null;
  }
  const contactRaw = toStringValue(row.contact.value) ?? "";
  let contactUrl: string | null = null;
  if (contactRaw.trim()) {
    try {
      const u = new URL(contactRaw.trim());
      contactUrl = u.protocol === "https:" ? u.toString() : null;
    } catch {
      contactUrl = null;
    }
  }
  const deadline = toStringValue(row.deadline.value);
  if (!deadline || !Number.isFinite(Date.parse(deadline))) return null;
  const budgetPresent = row.budgetPresent.value === true;
  const budgetRaw = row.budgetCents.value;
  const budgetCents = typeof budgetRaw === "bigint" ? Number(budgetRaw) : Number(budgetRaw);
  if (!Number.isSafeInteger(budgetCents) || budgetCents < 0) return null;
  const revisionRaw = row.revision.value;
  const revision = typeof revisionRaw === "bigint" ? Number(revisionRaw) : Number(revisionRaw);
  if (!Number.isSafeInteger(revision) || revision < 1) return null;
  void details;
  return {
    entityKey: row.$key,
    ownerAddress: row.$owner as Address,
    title,
    summary,
    category,
    language,
    status,
    budgetCents: budgetPresent ? budgetCents : null,
    contactUrl,
    deadline,
    revision,
    expiresAtBlock: typeof row.$expiresAt === "bigint" ? row.$expiresAt.toString() : null,
    fetchedAt,
    freshness: "fresh",
  };
}

export async function listOpportunities(
  rpc: OpportunityRpc,
  filters: OpportunityFilterInput = {},
): Promise<OpportunityView[]> {
  const client = publicClientForOpportunities(rpc);
  const predicates: Expression[] = [eq("app", OPPORTUNITY_NAMESPACE)];
  if (filters.category && filters.category !== "all") predicates.push(eq("category", filters.category));
  if (filters.language && filters.language !== "all") predicates.push(eq("language", filters.language));
  if (filters.status && filters.status !== "all") predicates.push(eq("status", filters.status));
  if (typeof filters.budgetPresent === "boolean") predicates.push(eq("budgetPresent", filters.budgetPresent));
  let page;
  try {
    const base = client.select().from(OPPORTUNITY_SCHEMA);
    // Schema-aware where() validates column names at the type level; the
    // combined expression is built dynamically, so apply it through a loose
    // bound call. Runtime semantics are unchanged (AND of indexed eq filters).
    const where = base.where.bind(base) as unknown as (expr: unknown) => typeof base;
    page = await (predicates.length === 1
      ? where(predicates[0]).limit(OPPORTUNITY_LIST_LIMIT).fetch()
      : where(and(...(predicates as [Expression, ...Expression[]]))).limit(OPPORTUNITY_LIST_LIMIT).fetch());
  } catch {
    throw new Error("briefmint: Arkiv listOpportunities failed.");
  }
  const fetchedAt = new Date().toISOString();
  const views: OpportunityView[] = [];
  for (const row of page.entities) {
    const view = toOpportunityView(row, fetchedAt);
    if (view !== null) views.push(view);
  }
  // Deterministic newest-first by fetched order is not guaranteed; keep chain
  // order and let the UI sort by deadline/revision explicitly when needed.
  return views;
}

export async function getOpportunity(rpc: OpportunityRpc, key: Hex): Promise<OpportunityView | null> {
  if (!isHexKey(key)) throw new Error("briefmint: getOpportunity needs a 32-byte entity key.");
  const client = publicClientForOpportunities(rpc);
  let row: OpportunityRow;
  try {
    row = await client.getEntity(key, OPPORTUNITY_SCHEMA);
  } catch (err) {
    if (err instanceof NoEntityFoundError || err instanceof SchemaMismatchError) return null;
    throw new Error("briefmint: Arkiv getOpportunity failed.");
  }
  return toOpportunityView(row, new Date().toISOString());
}
