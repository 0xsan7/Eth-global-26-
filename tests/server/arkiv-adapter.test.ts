import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ENTITY_BYTES, MAX_ATTRIBUTES } from "@arkiv-network/sdk/schema";
import { NoEntityFoundError } from "@arkiv-network/sdk";
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk/entity";
import { encodeEventTopics, TransactionReceiptNotFoundError } from "viem";
import { createArkivBriefmintReader, recordFromArkivRow } from "../../src/lib/arkiv/briefmint/read";
import { BriefmintOpportunitySchema, briefmintOpportunityValues } from "../../src/lib/arkiv/briefmint/schema";
import { projectPublicOpportunity, type BriefCandidate } from "../../src/lib/shared/briefs";

const mock = vi.hoisted(() => ({ client: {} as Record<string, unknown> }));
vi.mock("@arkiv-network/sdk", async importOriginal => ({ ...await importOriginal<typeof import("@arkiv-network/sdk")>(), createPublicClient: () => mock.client }));

const owner = `0x${"1".repeat(40)}`;
const key = `0x${"a".repeat(64)}`;
const candidate: BriefCandidate = {
  parameters: { title: "Community launch copy", summary: "Write launch copy.", category: "writing", language: "en", budgetUsdCents: null, deadline: "2026-11-07T00:00:00.000Z", contactUrl: null },
  sections: { deliverables: ["Launch copy"], acceptanceCriteria: ["Ready to publish"], exclusions: [], openQuestions: [] }, status: "open",
};

describe("BriefMint Arkiv adapter", () => {
  it("uses validated Arkiv values and round-trips only the canonical public payload", () => {
    const payload = projectPublicOpportunity(candidate, 1);
    const values = briefmintOpportunityValues(payload);
    expect(Object.keys(BriefmintOpportunitySchema.columns).length + 1).toBeLessThanOrEqual(MAX_ATTRIBUTES);
    expect((values.content.value.length + values.title.value.length - 4) / 2).toBeLessThanOrEqual(MAX_ENTITY_BYTES);
    expect(values.schemaVersion.value).toBe(1n);
    expect(values.deadlineUnixSeconds.value).toBe(BigInt(Date.parse(candidate.parameters.deadline) / 1000));
    expect(values.content.value).toMatch(/^0x/);
    const record = recordFromArkivRow({ ...values, $key: key, $owner: owner, $expiresAt: { value: 999n } }, "123", "2026-11-06T00:00:00.000Z");
    expect(record).toMatchObject({ entityKey: key, ownerAddress: owner, payload, expiresAtBlock: "999", observedAtBlock: "123" });
  });

  it("rejects an entity whose indexed discovery fields disagree with its content", () => {
    const values = briefmintOpportunityValues(projectPublicOpportunity(candidate, 1));
    expect(() => recordFromArkivRow({ ...values, category: { value: "design" }, $key: key, $owner: owner, $expiresAt: { value: 999n } }, "123", "2026-11-06T00:00:00.000Z")).toThrow(/indexed fields/);
  });

  it("supports multibyte titles and rejects a title inconsistent with content", () => {
    const payload = projectPublicOpportunity({ ...candidate, parameters: { ...candidate.parameters, title: "界".repeat(100) } }, 1);
    const values = briefmintOpportunityValues(payload);
    expect((values.content.value.length + values.title.value.length - 4) / 2).toBeLessThanOrEqual(MAX_ENTITY_BYTES);
    expect(recordFromArkivRow({ ...values, $key: key, $owner: owner, $expiresAt: { value: 999n } }, "123", "2026-11-06T00:00:00.000Z").payload.title).toBe(payload.title);
    const other = briefmintOpportunityValues(projectPublicOpportunity(candidate, 1));
    expect(() => recordFromArkivRow({ ...values, title: other.title, $key: key, $owner: owner, $expiresAt: { value: 999n } }, "123", "2026-11-06T00:00:00.000Z")).toThrow(/title/);
  });
});

describe("BriefMint Arkiv reader", () => {
  const hash = `0x${"b".repeat(64)}`;
  const engine = "0x4400000000000000000000000000000000000044";
  const log = { address: engine, data: "0x", topics: encodeEventTopics({ abi: ENTITY_EVENTS_ABI, eventName: "EntityPatched", args: { entityKey: key as `0x${string}`, owner: owner as `0x${string}` } }) };
  beforeEach(() => { mock.client = {}; });
  it("verifies the actual chain and hashes before accepting receipt evidence", async () => {
    const receipt = { transactionHash: hash, status: "success", blockNumber: 10n, logs: [log] };
    mock.client = { getChainId: vi.fn().mockResolvedValue(7794095), getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
      getTransaction: vi.fn().mockResolvedValue({ hash, from: owner, to: engine }) };
    const reader = createArkivBriefmintReader({ accessKey: "test" });
    expect(await reader.transaction(hash)).toMatchObject({ status: "confirmed", signer: owner, entityKeys: [key] });
    (mock.client.getChainId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
    await expect(reader.transaction(hash)).rejects.toThrow(/chain/);
    (mock.client.getTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...receipt, transactionHash: key });
    await expect(reader.transaction(hash)).rejects.toThrow(/hash/);
    (mock.client.getTransaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hash: key, from: owner, to: engine });
    await expect(reader.transaction(hash)).rejects.toThrow(/hash/);
    (mock.client.getTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...receipt, logs: [{ ...log, address: owner }] });
    await expect(reader.transaction(hash)).rejects.toThrow(/evidence/);
    (mock.client.getTransaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ hash, from: owner, to: owner });
    await expect(reader.transaction(hash)).rejects.toThrow(/engine/);
    (mock.client.getTransactionReceipt as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TransactionReceiptNotFoundError({ hash: hash as `0x${string}` }));
    expect(await reader.transaction(hash)).toMatchObject({ status: "pending", signer: null });
    (mock.client.getTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...receipt, status: "reverted", logs: [] });
    expect(await reader.transaction(hash)).toMatchObject({ status: "reverted", entityKeys: [], blockNumber: "10" });
  });
  it("filters exact deadlines, requires a present budget, and advances across skipped rows", async () => {
    const values = briefmintOpportunityValues(projectPublicOpportunity({ ...candidate, parameters: { ...candidate.parameters, deadline: "2026-11-07T00:00:00.100Z" } }, 1));
    const predicates: unknown[] = [];
    const query = { from() { return this; }, where(value: unknown) { predicates.push(value); return this; }, orderBy() { return this; }, limit() { return this; }, offset: vi.fn().mockReturnThis(),
      fetch: vi.fn().mockResolvedValue({ entities: [{ ...values, $key: key, $owner: owner, $expiresAt: { value: 999n } }], skipped: 1, blockNumber: 123n }) };
    mock.client = { getChainId: async () => 7794095, select: () => query, getBlock: vi.fn().mockResolvedValue({ timestamp: 1793923200n }) };
    const reader = createArkivBriefmintReader({ accessKey: "test" });
    const page = await reader.list({ language: "en", status: "open", minBudgetUsdCents: 0, deadlineAfter: "2026-11-07T00:00:00.500Z", limit: 2 });
    expect(page.records).toEqual([]); expect(page.nextCursor).toBe("2");
    expect(predicates).toContainEqual(expect.objectContaining({ name: "budgetPresent", operator: "=", value: expect.objectContaining({ type: "bool", value: true }) }));
    expect(predicates).toContainEqual(expect.objectContaining({ name: "status", value: expect.objectContaining({ value: "open" }) }));
    expect(predicates).toContainEqual(expect.objectContaining({ name: "language", value: expect.objectContaining({ value: "en" }) }));
    expect(mock.client.getBlock).toHaveBeenCalledWith({ blockNumber: 123n });
    expect(await reader.list({ language: "en", status: "open", deadlineAfter: "2026-11-06T00:00:00.000Z", limit: 2 })).toMatchObject({ records: [expect.objectContaining({ observedAtBlock: "123" })] });
    query.fetch.mockResolvedValueOnce({ entities: [{ ...values, $key: key, $owner: owner, $expiresAt: { value: 123n } }], skipped: 0, blockNumber: 123n });
    expect((await reader.list({ language: "en", status: "open", deadlineAfter: "2026-11-06T00:00:00.000Z", limit: 2 })).records).toEqual([]);
    query.fetch.mockRejectedValueOnce(new Error("synthetic network failure"));
    await expect(reader.list({ language: "en", status: "closed", deadlineAfter: "2026-11-06T00:00:00.000Z", limit: 2 })).rejects.toThrow(/network/);
    expect(predicates).toContainEqual(expect.objectContaining({ name: "status", value: expect.objectContaining({ value: "closed" }) }));
  });
  it("distinguishes successful absence from transport failure and observes get after the row read", async () => {
    const calls: string[] = [];
    const values = briefmintOpportunityValues(projectPublicOpportunity(candidate, 1));
    mock.client = { getChainId: async () => 7794095,
      getEntity: vi.fn(async () => { calls.push("entity"); return { ...values, $key: key, $owner: owner, $expiresAt: 999n }; }),
      getBlockTiming: async () => { calls.push("block"); return { currentBlock: 123n, currentBlockTime: 1793923200, blockDuration: 12 }; } };
    const reader = createArkivBriefmintReader({ accessKey: "test" });
    expect(await reader.get(key)).toMatchObject({ entityKey: key, observedAtBlock: "123" }); expect(calls).toEqual(["entity", "block"]);
    (mock.client.getEntity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new NoEntityFoundError(key));
    expect(await reader.get(key)).toBeNull();
    (mock.client.getEntity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("synthetic RPC failure"));
    await expect(reader.get(key)).rejects.toThrow(/RPC/);
  });
});
