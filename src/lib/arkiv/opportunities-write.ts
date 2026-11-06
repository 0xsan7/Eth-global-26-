// Browser-only BriefMint opportunity writes — Agent B owned.
// The project-owner wallet signs creates/updates/closure through its own
// connected transport. There is no shared server key; this module never
// requests or handles a private key. Never imported by read modules.
// Errors are sanitized and no explorer links are fabricated for failed
// broadcasts. A submitted transaction is NOT success: callers must reconcile
// the confirmed entity through the backend before treating it as live.
import {
  ExpirationTime,
  MAX_STRING_BYTES,
  createWalletClient,
  type PatchEntityValues,
} from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { bool, bytes, str, u64 } from "@arkiv-network/sdk/schema";
import type { Transport } from "viem";
import type {
  Address,
  BriefCategory,
  Hex,
  OpportunityStatus,
} from "@/lib/shared/briefmint";
import { isAddress } from "@/lib/shared/validation";
import {
  OPPORTUNITY_SCHEMA,
  encodeDetails,
  encodeUtf8,
  type OpportunityDetailsJson,
} from "./opportunity-schema";

export type OpportunityInput = {
  title: string;
  summary: string;
  category: BriefCategory;
  language: "en";
  status: OpportunityStatus;
  budgetCents: number | null;
  contactUrl: string | null;
  deadline: string;
  details: OpportunityDetailsJson;
  revision: number;
};

export type OpportunityPatch = {
  title?: string;
  summary?: string;
  status?: OpportunityStatus;
  contactUrl?: string | null;
  details?: OpportunityDetailsJson;
  revision?: number;
};

export type OpportunityReceipt = { entityKey: Hex; txHash: Hex };
export type OpportunityCreation = OpportunityReceipt & { expiresAtBlock: string };

function isHexKey(v: unknown): v is Hex {
  return typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
}

function requireShort(field: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`briefmint: opportunity ${field} is empty.`);
  if (encodeUtf8(trimmed).length > MAX_STRING_BYTES)
    throw new Error(`briefmint: opportunity ${field} exceeds ${MAX_STRING_BYTES} UTF-8 bytes.`);
  return trimmed;
}

function requireContact(value: string | null): string {
  if (value === null) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const u = new URL(trimmed);
  if (u.protocol !== "https:") throw new Error("briefmint: contact URL must be https.");
  return requireShort("contact", u.toString());
}

function walletFor(transport: Transport, account: Address) {
  if (!isAddress(account)) throw new Error("briefmint: a connected owner wallet is required.");
  return createWalletClient({ chain: rabdi({ accessKey: "" }), transport, account });
}

function baseColumns(input: OpportunityInput) {
  if (input.category !== "writing" && input.category !== "design")
    throw new Error("briefmint: category must be writing or design.");
  if (input.language !== "en") throw new Error("briefmint: language must be en.");
  if (input.status !== "open" && input.status !== "closed")
    throw new Error("briefmint: status must be open or closed.");
  if (!Number.isFinite(Date.parse(input.deadline))) throw new Error("briefmint: deadline must be ISO.");
  if (!Number.isSafeInteger(input.revision) || input.revision < 1)
    throw new Error("briefmint: revision must be a positive integer.");
  const budgetCents = input.budgetCents ?? 0;
  if (input.budgetCents !== null && (!Number.isSafeInteger(input.budgetCents) || input.budgetCents < 0))
    throw new Error("briefmint: budget must be non-negative integer cents.");
  return {
    app: str("tool-city.opportunity.v1"),
    category: str(input.category),
    language: str("en"),
    status: str(input.status),
    budgetPresent: bool(input.budgetCents !== null),
    budgetCents: u64(budgetCents),
    deadline: str(input.deadline),
    title: str(requireShort("title", input.title)),
    summary: bytes(encodeUtf8(input.summary.trim())),
    details: bytes(encodeDetails(input.details)),
    contact: str(requireContact(input.contactUrl)),
    revision: u64(input.revision),
  };
}

/** Owner-signed publication. Default 30-day expiry; pass expiresInDays for a labelled short-lived demo. */
export async function createOpportunity(
  transport: Transport,
  account: Address,
  input: OpportunityInput,
  opts: { expiresInDays?: number } = {},
): Promise<OpportunityCreation> {
  const wallet = walletFor(transport, account);
  const days = opts.expiresInDays ?? 30;
  if (!Number.isFinite(days) || days <= 0 || days > 365) throw new Error("briefmint: expiry window is invalid.");
  let result;
  try {
    result = await wallet.createEntity(OPPORTUNITY_SCHEMA, baseColumns(input), {
      expiration: ExpirationTime.fromDays(days),
    });
  } catch {
    throw new Error("briefmint: Arkiv createOpportunity failed.");
  }
  return { entityKey: result.entityKey as Hex, txHash: result.txHash as Hex, expiresAtBlock: result.expiresAt.toString() };
}

export async function updateOpportunity(
  transport: Transport,
  account: Address,
  entityKey: Hex,
  patch: OpportunityPatch,
): Promise<OpportunityReceipt> {
  if (!isHexKey(entityKey)) throw new Error("briefmint: updateOpportunity needs a 32-byte entity key.");
  const set: PatchEntityValues<typeof OPPORTUNITY_SCHEMA> = {
    ...(patch.title !== undefined ? { title: str(requireShort("title", patch.title)) } : {}),
    ...(patch.summary !== undefined ? { summary: bytes(encodeUtf8(patch.summary.trim())) } : {}),
    ...(patch.status !== undefined
      ? { status: str(patch.status === "open" || patch.status === "closed" ? patch.status : "open") }
      : {}),
    ...(patch.contactUrl !== undefined ? { contact: str(requireContact(patch.contactUrl)) } : {}),
    ...(patch.details !== undefined ? { details: bytes(encodeDetails(patch.details)) } : {}),
    ...(patch.revision !== undefined
      ? (() => {
          if (!Number.isSafeInteger(patch.revision) || (patch.revision as number) < 1)
            throw new Error("briefmint: revision must be a positive integer.");
          return { revision: u64(patch.revision as number) };
        })()
      : {}),
  };
  if (Object.keys(set).length === 0) throw new Error("briefmint: updateOpportunity needs at least one field.");
  const wallet = walletFor(transport, account);
  let result;
  try {
    result = await wallet.patchEntity(OPPORTUNITY_SCHEMA, entityKey, { set });
  } catch {
    throw new Error("briefmint: Arkiv updateOpportunity failed.");
  }
  return { entityKey, txHash: result.txHash as Hex };
}

/** Closure is an explicit owner-signed `status=closed` update. Closed records stay readable until expiry. */
export async function closeOpportunity(
  transport: Transport,
  account: Address,
  entityKey: Hex,
): Promise<OpportunityReceipt> {
  return updateOpportunity(transport, account, entityKey, { status: "closed" });
}
