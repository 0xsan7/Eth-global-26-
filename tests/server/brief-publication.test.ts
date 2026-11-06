import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/lib/server/db";
import { BriefService, getBrief, saveBrief } from "../../src/lib/server/briefs";
import { BriefPublicationService, type PublicationReader } from "../../src/lib/server/brief-publication";
import { hashPublicOpportunity, projectPublicOpportunity, type BriefView } from "../../src/lib/shared/briefs";

const id = `0x${"a".repeat(64)}`, intentId = `0x${"b".repeat(64)}`, tx = `0x${"c".repeat(64)}`, key = `0x${"d".repeat(64)}`;
const owner = `0x${"1".repeat(40)}`, other = `0x${"2".repeat(40)}`;
const time = "2026-11-06T00:00:00.000Z";
const candidate = { parameters: { title: "Graphics", summary: "Create graphics", category: "design" as const, language: "en" as const,
  budgetUsdCents: null, deadline: "2026-11-07T00:00:00.000Z", contactUrl: null },
  sections: { deliverables: ["Graphic"], acceptanceCriteria: ["Editable"], exclusions: [], openQuestions: [] }, status: "open" as const };
const item = { text: "Graphic", sourceIds: ["seg_001"], basis: "provided" as const };
let db: ReturnType<typeof openDatabase>;
let brief: BriefView;
let reader: PublicationReader;
let service: BriefPublicationService;
let hash: string;
let receipt: Awaited<ReturnType<PublicationReader["transaction"]>>;
let record: Awaited<ReturnType<PublicationReader["get"]>>;

beforeEach(async () => {
  db = openDatabase(":memory:");
  const payload = projectPublicOpportunity(candidate, 1); hash = await hashPublicOpportunity(payload);
  brief = { schemaVersion: 1, kind: "brief.compile.v1", id, ownerAddress: owner,
    inputSegments: [{ id: "seg_001", text: "Private" }], publicParameters: candidate.parameters, executionStatus: "ready",
    attemptsUsed: 1, retryEligible: false, immutableModelResult: { deliverables: [item], acceptanceCriteria: [item], exclusions: [], openQuestions: [] },
    editedDraft: structuredClone(candidate), draftRevision: 1, evidence: null, error: null,
    review: { status: "approved", approval: { draftRevision: 1, publicPayloadHash: hash, canonicalPublicPayload: payload, approvedBy: owner, approvedAt: time } },
    publication: { status: "unpublished", freshness: "unavailable", confirmed: null, pending: null }, createdAt: time, updatedAt: time };
  db.prepare("INSERT INTO briefs(id,owner,view_json,status,created_at) VALUES(?,?,?,?,?)").run(id, owner, JSON.stringify(brief), "ready", time);
  receipt = { status: "pending", chainId: 7794095, signer: null, entityKeys: [], blockNumber: null };
  record = null;
  reader = { currentBlock: async () => ({ number: "101", timestamp: String(Date.parse(time) / 1000), blockTimeSeconds: 12 }),
    transaction: async () => receipt, get: async () => record, list: async () => ({ records: [], nextCursor: null }) };
  service = new BriefPublicationService(db, reader, () => new Date(time));
});
afterEach(() => db.close());
const request = () => ({ intentId, expectedRevision: 1, publicPayloadHash: hash, operation: "create" as const });
const reconcile = (transactionHash: string | null = null, entityKey: string | null = null) => ({ intentId, transactionHash, entityKey });

describe("publication intent and independent reconciliation", () => {
  it("persists immutable intent, returns duplicate, and blocks a second create even with unknown broadcast", async () => {
    const intent = await service.prepare(owner, id, request());
    expect(intent.expiresAtBlock).toBe("7301");
    expect(await service.prepare(owner, id, request())).toEqual(intent);
    await expect(service.prepare(owner, id, { ...request(), intentId: key })).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect((await service.reconcile(owner, id, reconcile())).pending).toBe(true);
    await expect(service.prepare(other, id, request())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it.each([null, tx])("refuses prepare retries once reconciliation has started with transaction %s", async transactionHash => {
    const intent = await service.prepare(owner, id, request());
    expect(await service.prepare(owner, id, request())).toEqual(intent);
    expect((await service.reconcile(owner, id, reconcile(transactionHash))).pending).toBe(true);
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT", status: 409 });
  });
  it("rechecks approval when a concurrent duplicate wins preparation", async () => {
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    let calls = 0;
    reader.currentBlock = async () => {
      if (++calls === 1) { started(); await gate; }
      return { number: "101", timestamp: String(Date.parse(time) / 1000), blockTimeSeconds: 12 };
    };
    const slow = service.prepare(owner, id, request());
    await entered;
    await service.prepare(owner, id, request());
    const edited = getBrief(db, owner, id);
    edited.draftRevision = 2; edited.review = { status: "unreviewed", approval: null };
    edited.editedDraft!.parameters.title = "New title"; saveBrief(db, edited);
    release();
    await expect(slow).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });
  it("records an old approved payload after a newer private edit only on matching receipt and entity", async () => {
    const intent = await service.prepare(owner, id, request());
    const edited = getBrief(db, owner, id); edited.draftRevision = 2; edited.review = { status: "unreviewed", approval: null };
    edited.editedDraft!.parameters.title = "New title"; saveBrief(db, edited);
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    const result = await service.reconcile(owner, id, reconcile(tx));
    expect(result).toMatchObject({ pending: false, brief: { draftRevision: 2, publication: { status: "live", confirmed: { publicRevision: 1, observedPayloadHash: hash } } } });
    expect((await service.reconcile(owner, id, reconcile(tx, key))).pending).toBe(false);
  });
  it("rejects wrong signer, entity and payload without crediting a publication", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: other, entityKeys: [key], blockNumber: "101" };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    receipt = { ...receipt, signer: owner };
    record = { entityKey: key, ownerAddress: owner, payload: { ...intent.payload, title: "Changed" }, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication.confirmed).toBeNull();
  });
  it("refuses changed expiry and preserves the pending intent on RPC failure", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: "7302", observedAtBlock: "101", observedAt: time };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    reader.get = async () => { throw new Error("private RPC details"); };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE", message: "Arkiv is unavailable." });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "pending", freshness: "unavailable", pending: { transactionHash: tx } });
  });
  it("publishes an approved edit and then closes the same entity", async () => {
    const create = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: create.payload, expiresAtBlock: create.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await service.reconcile(owner, id, reconcile(tx, key));

    const briefs = new BriefService(db, () => Date.parse(time));
    const revised = structuredClone(candidate); revised.parameters.title = "Updated graphics";
    const saved = briefs.saveDraft(owner, id, { expectedRevision: 1, draft: revised });
    const updatedHash = await hashPublicOpportunity(projectPublicOpportunity(revised, saved.draftRevision));
    await briefs.approve(owner, id, { expectedRevision: 2, publicPayloadHash: updatedHash });
    const updateId = `0x${"e".repeat(64)}`, updateTx = `0x${"f".repeat(64)}`;
    const update = await service.prepare(owner, id, { intentId: updateId, operation: "update", expectedRevision: 2, publicPayloadHash: updatedHash });
    expect(update).toMatchObject({ entityKey: key, basePayloadHash: hash, expiresAtBlock: create.expiresAtBlock, payload: { revision: 2, title: "Updated graphics" } });
    record = { ...record, payload: update.payload };
    const updateResult = await service.reconcile(owner, id, { intentId: updateId, transactionHash: updateTx, entityKey: key });
    expect(updateResult).toMatchObject({ pending: false, brief: { publication: { status: "live", confirmed: { publicRevision: 2, observedPayloadHash: updatedHash, lastConfirmedTransaction: updateTx } } } });

    const closedDraft = { ...revised, status: "closed" as const };
    const closedSaved = briefs.saveDraft(owner, id, { expectedRevision: 2, draft: closedDraft });
    const closedHash = await hashPublicOpportunity(projectPublicOpportunity(closedDraft, closedSaved.draftRevision));
    await briefs.approve(owner, id, { expectedRevision: 3, publicPayloadHash: closedHash });
    const closeId = `0x${"2".repeat(64)}`, closeTx = `0x${"3".repeat(64)}`;
    const close = await service.prepare(owner, id, { intentId: closeId, operation: "close", expectedRevision: 3, publicPayloadHash: closedHash });
    expect(close).toMatchObject({ entityKey: key, basePayloadHash: updatedHash, expiresAtBlock: create.expiresAtBlock, payload: { revision: 3, status: "closed" } });
    record = { ...record, payload: close.payload };
    const result = await service.reconcile(owner, id, { intentId: closeId, transactionHash: closeTx, entityKey: key });
    expect(result).toMatchObject({ pending: false, brief: { publication: { status: "closed", confirmed: { entityKey: key, publicRevision: 3, observedPayloadHash: closedHash, lastConfirmedTransaction: closeTx }, pending: null } } });
  });
  it("retains the last confirmation while an update receipt is uncertain or unavailable", async () => {
    const create = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: create.payload, expiresAtBlock: create.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    const initial = await service.reconcile(owner, id, reconcile(tx, key));
    const confirmed = initial.brief.publication.confirmed;
    const briefs = new BriefService(db, () => Date.parse(time));
    const revised = structuredClone(candidate); revised.parameters.title = "Updated graphics";
    briefs.saveDraft(owner, id, { expectedRevision: 1, draft: revised });
    const revisedHash = await hashPublicOpportunity(projectPublicOpportunity(revised, 2));
    await briefs.approve(owner, id, { expectedRevision: 2, publicPayloadHash: revisedHash });
    const updateId = `0x${"e".repeat(64)}`, updateTx = `0x${"f".repeat(64)}`;
    await service.prepare(owner, id, { intentId: updateId, operation: "update", expectedRevision: 2, publicPayloadHash: revisedHash });
    receipt = { status: "reverted", chainId: 7794095, signer: owner, entityKeys: [], blockNumber: "101" };
    const unresolved = await service.reconcile(owner, id, { intentId: updateId, transactionHash: updateTx, entityKey: key });
    expect(unresolved).toMatchObject({ pending: true, brief: { publication: { status: "pending", confirmed, pending: { transactionHash: updateTx } } } });
    reader.transaction = async () => { throw new Error("RPC failure"); };
    await expect(service.reconcile(owner, id, { intentId: updateId, transactionHash: updateTx, entityKey: key })).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "pending", freshness: "unavailable", confirmed, pending: { transactionHash: updateTx } });
  });
  it("does not return a settled intent for signing again", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await service.reconcile(owner, id, reconcile(tx, key));
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
  });
  it("keeps external changes blocked on repeated prepare attempts", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await service.reconcile(owner, id, reconcile(tx, key));
    record = { ...record, payload: { ...record.payload, title: "External" } };
    const update = { ...request(), intentId: `0x${"e".repeat(64)}`, operation: "update" };
    await expect(service.prepare(owner, id, update)).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication.confirmed?.externalChange).toBe(true);
    await expect(service.prepare(owner, id, update)).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
  });
  it("uses the current block to prove expiry when the entity is absent", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await service.reconcile(owner, id, reconcile(tx, key));
    record = null;
    const update = { ...request(), intentId: `0x${"e".repeat(64)}`, operation: "update" };
    await expect(service.prepare(owner, id, update)).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "live", freshness: "unavailable" });
    reader.currentBlock = async () => ({ number: intent.expiresAtBlock, timestamp: String(Date.parse(time) / 1000 + 86400), blockTimeSeconds: 12 });
    await expect(service.prepare(owner, id, update)).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "expired", freshness: "fresh" });
  });
  it("rejects observations ahead of the current block", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "102" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "102", observedAt: time };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    expect(getBrief(db, owner, id).publication.status).toBe("pending");
  });
  it.each(["pending", "failure"])("does not let a late %s response overwrite a concurrent confirmation", async outcome => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    let calls = 0;
    reader.transaction = async () => {
      if (++calls === 1) {
        started(); await gate;
        if (outcome === "failure") throw new Error("late RPC error");
        return { status: "pending", chainId: 7794095, signer: null, entityKeys: [], blockNumber: null };
      }
      return receipt;
    };
    const slow = service.reconcile(owner, id, reconcile(tx, key));
    await entered;
    expect((await service.reconcile(owner, id, reconcile(tx, key))).pending).toBe(false);
    release();
    expect(await slow).toMatchObject({ pending: false, brief: { publication: { status: "live", freshness: "fresh" } } });
  });
  it("keeps unbound reverted receipts pending and fails closed when reader is unavailable", async () => {
    await expect(new BriefPublicationService(db).prepare(owner, id, request())).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    await service.prepare(owner, id, request());
    receipt = { status: "reverted", chainId: 7794095, signer: owner, entityKeys: [], blockNumber: "101" };
    expect(await service.reconcile(owner, id, reconcile(tx))).toMatchObject({ pending: true, brief: { publication: { status: "pending", confirmed: null } } });
  });
});
