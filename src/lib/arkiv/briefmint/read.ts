import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk/entity";
import { asc, eq, gte } from "@arkiv-network/sdk/query";
import { str, u64 } from "@arkiv-network/sdk/schema";
import { decodeEventLog, hexToBytes, http, TransactionReceiptNotFoundError } from "viem";
import { BRIEFMINT_CHAIN_ID, OPPORTUNITY_NAMESPACE, opportunityFilterSchema, opportunityRecordSchema, publicOpportunitySchema, type BriefmintArkivReader, type OpportunityRecord } from "../../shared/briefs";
import { BriefmintOpportunitySchema } from "./schema";

/** Arkiv engine address in the pinned SDK/network version; receipt topics alone are forgeable. */
const ARKIV_ENGINE_ADDRESS = "0x4400000000000000000000000000000000000044";
type ArkivValue = { value?: unknown } | unknown;
const unbox = (value: ArkivValue) => value !== null && typeof value === "object" && "value" in value ? (value as { value: unknown }).value : value;
function toText(value: ArkivValue) { const raw = unbox(value); if (typeof raw === "string") return raw.startsWith("0x") ? new TextDecoder().decode(hexToBytes(raw as `0x${string}`)) : raw; return new TextDecoder().decode(raw as Uint8Array); }
/** Pure validation boundary for every public Arkiv row before it can reach BriefMint state. */
export function recordFromArkivRow(row: Record<string, unknown>, observedAtBlock: string, observedAt: string): OpportunityRecord {
  const payload = publicOpportunitySchema.parse(JSON.parse(toText(row.content)));
  const indexed = { app: unbox(row.app), schemaVersion: unbox(row.schemaVersion), category: unbox(row.category), language: unbox(row.language), status: unbox(row.status), budgetPresent: unbox(row.budgetPresent), budgetUsdCents: unbox(row.budgetUsdCents), deadlineUnixSeconds: unbox(row.deadlineUnixSeconds) };
  if (indexed.app !== OPPORTUNITY_NAMESPACE || indexed.schemaVersion !== 1n || indexed.category !== payload.category || indexed.language !== payload.language || indexed.status !== payload.status || indexed.budgetPresent !== (payload.budgetUsdCents !== null) || indexed.budgetUsdCents !== BigInt(payload.budgetUsdCents ?? 0) || indexed.deadlineUnixSeconds !== BigInt(Math.floor(Date.parse(payload.deadline) / 1000))) throw new Error("Arkiv indexed fields do not match public content.");
  return opportunityRecordSchema.parse({ entityKey: row.$key, ownerAddress: row.$owner, payload, expiresAtBlock: String(unbox(row.$expiresAt)), observedAtBlock, observedAt });
}

export function createArkivBriefmintReader({ accessKey }: { accessKey: string }): BriefmintArkivReader & { currentBlock(): Promise<{ number: string; timestamp: string; blockTimeSeconds: number }>; readiness(): Promise<boolean> } {
  const client = createPublicClient({ chain: rabdi({ accessKey }), transport: http() });
  const observation = async () => { const timing = await client.getBlockTiming(); return { number: timing.currentBlock.toString(), timestamp: String(timing.currentBlockTime), blockTimeSeconds: timing.blockDuration, observedAt: new Date(timing.currentBlockTime * 1000).toISOString() }; };
  return {
    async readiness() { try { await client.getBlockNumber(); return true; } catch { return false; } },
    async currentBlock() { const value = await observation(); return { number: value.number, timestamp: value.timestamp, blockTimeSeconds: value.blockTimeSeconds }; },
    async get(entityKey) { const seen = await observation(); try { const row = await client.getEntity(entityKey as `0x${string}`, BriefmintOpportunitySchema); return recordFromArkivRow(row as unknown as Record<string, unknown>, seen.number, seen.observedAt); } catch (error) { if (error instanceof Error && error.name === "NoEntityFoundError") return null; throw error; } },
    async list(filter) { const input = opportunityFilterSchema.parse(filter); const seen = await observation(); const offset = input.cursor === undefined ? 0 : Number(input.cursor);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Arkiv list cursor is invalid.");
      let query = client.select().from(BriefmintOpportunitySchema)
        .where(eq("app", str(OPPORTUNITY_NAMESPACE))).where(eq("schemaVersion", u64(1)))
        .where(eq("language", str(input.language))).where(eq("status", str(input.status)))
        .where(gte("deadlineUnixSeconds", u64(Math.floor(Date.parse(input.deadlineAfter) / 1000))));
      if (input.category) query = query.where(eq("category", str(input.category)));
      if (input.minBudgetUsdCents !== undefined) query = query.where(gte("budgetUsdCents", u64(input.minBudgetUsdCents)));
      const page = await query.orderBy(asc("$key")).limit(input.limit).offset(offset).fetch();
      const records = page.entities.map(row => recordFromArkivRow(row as unknown as Record<string, unknown>, seen.number, seen.observedAt));
      return { records, nextCursor: page.entities.length === input.limit ? String(offset + page.entities.length) : null };
    },
    async transaction(transactionHash) { let receipt; try { receipt = await client.getTransactionReceipt({ hash: transactionHash as `0x${string}` }); } catch (error) { if (error instanceof TransactionReceiptNotFoundError) return { status: "pending" as const, chainId: BRIEFMINT_CHAIN_ID, signer: null, entityKeys: [] as [], blockNumber: null }; throw error; } const transaction = await client.getTransaction({ hash: transactionHash as `0x${string}` });
      if (receipt.status === "reverted") return { status: "reverted" as const, chainId: BRIEFMINT_CHAIN_ID, signer: transaction.from, entityKeys: [] as [], blockNumber: receipt.blockNumber.toString() };
      const keys: string[] = []; for (const log of receipt.logs) { if (log.address.toLowerCase() !== ARKIV_ENGINE_ADDRESS) continue; try { const decoded = decodeEventLog({ abi: ENTITY_EVENTS_ABI, topics: log.topics, data: log.data }); const key = decoded.args.entityKey; if (typeof key === "string" && !keys.includes(key)) keys.push(key); } catch { /* Ignore unrelated logs. */ } }
      return { status: "confirmed" as const, chainId: BRIEFMINT_CHAIN_ID, signer: transaction.from, entityKeys: keys, blockNumber: receipt.blockNumber.toString() };
    },
  };
}
