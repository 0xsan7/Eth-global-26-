import { afterEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { encodeAbiParameters, encodeEventTopics, parseAbi, TransactionReceiptNotFoundError, type PublicClient } from "viem";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Address, CheckoutTerms, Hex, PublicConfig, WorkshopView } from "../../src/lib/shared/domain";
import { checkoutAbi } from "../../src/lib/shared/checkout-abi";
import { openDatabase, type Database } from "../../src/lib/server/db";
import { AuthService } from "../../src/lib/server/auth";
import type { ServerEnv } from "../../src/lib/server/env";
import { getServerEnv } from "../../src/lib/server/env";
import { JobService, saveJob } from "../../src/lib/server/jobs";
import { PaymentService, verifyOnchain } from "../../src/lib/server/payment";
import { Runner, reconcileExpiredLeases } from "../../src/lib/server/recovery";
import { createInferenceProvider, type InferenceProvider } from "../../src/lib/server/inference";
import { ServiceError } from "../../src/lib/server/errors";
import { listSettlements, settlementCsv } from "../../src/lib/server/settlements";
import { handle } from "../../src/lib/server/http";

const buyer = privateKeyToAccount(`0x${"01".repeat(32)}`);
const other = privateKeyToAccount(`0x${"02".repeat(32)}`);
const merchant = privateKeyToAccount(`0x${"03".repeat(32)}`);
const hash = (n: string) => `0x${n.repeat(64)}` as Hex;
const terms: CheckoutTerms = { chainId: 1874, checkoutAddress: `0x${"44".repeat(20)}`, tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7", tokenDecimals: 6, amountAtomic: "1000000", merchantAddress: merchant.address, serviceId: hash("5"), termsHash: hash("6") };
const config: PublicConfig = { schemaVersion: 1, configured: true, appNamespace: "tool-city.workshop.v1", sourceLang: "en", targetLang: "hi", maxWords: 250, maxChars: 5000, arkiv: { chainId: 7794095, rpcUrl: "https://invalid.test", explorerUrl: "https://invalid.test" }, whitechain: { chainId: 1874, rpcUrl: "https://invalid.test", explorerUrl: "https://invalid.test", tokenAddress: terms.tokenAddress }, terms, serviceTermsText: "Test only" };
const listing: WorkshopView = { entityKey: hash("7"), ownerAddress: merchant.address, title: "Test only", description: "Test only", active: true, sourceLang: "en", targetLang: "hi", jobType: "text.translate", checkoutChainId: 1874, checkoutAddress: terms.checkoutAddress, serviceId: terms.serviceId, termsHash: terms.termsHash, expiresAtBlock: null, fetchedAt: new Date().toISOString(), freshness: "fresh", supported: true };
const env: ServerEnv = { appOrigin: "http://localhost:3000", allowedOrigins: ["http://localhost:3000"], sessionSecret: "test-secret-".repeat(4), databasePath: ":memory:", rpcUrl: undefined, inferenceKey: "test-only", inferenceBaseUrl: "https://router.invalid/v1", modelId: "test-model", inferenceTimeoutMs: 1000, paymentConfirmations: 3, secureCookies: false };
const opened: Database[] = [];
const dirs: string[] = [];
function db() { const value = openDatabase(":memory:"); opened.push(value); return value; }
function service(database: Database, workshop = listing) { return new JobService(database, config, async () => workshop, Date.now, async () => {}); }
async function unpaid(database: Database) { return service(database).create(buyer.address, listing.entityKey, "Hello Asha. Visit https://example.org on 6 November 2026.\n\nThere are 42 people."); }
async function paid(database: Database) { const job = await unpaid(database); return (await new PaymentService(database, async () => ({ pending: false, blockNumber: "100" })).verify(buyer.address, job.id, hash("8"))).job; }
const evidence = { requestId: null, modelId: null, providerId: null, routingTier: null, verificationRequested: true, routerTeeVerified: null };
const good: InferenceProvider = { assertReady() {}, async translate(source) { return { segments: source.map(s => ({ id: s.id, text: `अनुवाद ${s.id}` })), evidence }; } };
afterEach(() => { for (const database of opened.splice(0)) database.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("wallet authentication", () => {
  it("binds address/domain/nonce/expiry, rejects wrong signature and replays, and revokes logout", async () => {
    const auth = new AuthService(db(), env);
    const challenge = auth.challenge(buyer.address);
    expect(challenge.message).toContain("URI: http://localhost:3000");
    expect(challenge.message).toContain(buyer.address);
    await expect(auth.verify(challenge.challengeId, await other.signMessage({ message: challenge.message }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const result = await auth.verify(challenge.challengeId, await buyer.signMessage({ message: challenge.message }));
    const request = new Request(env.appOrigin, { headers: { cookie: result.cookie.split(";")[0] } });
    expect(auth.session(request).address).toBe(buyer.address);
    await expect(auth.verify(challenge.challengeId, await buyer.signMessage({ message: challenge.message }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    auth.logout(request);
    expect(() => auth.session(request)).toThrowError(expect.objectContaining({ code: "UNAUTHENTICATED" }));
  });
  it("rejects expired challenges, unsigned sessions and untrusted origins", async () => {
    let now = 1000;
    const auth = new AuthService(db(), env, () => now);
    const challenge = auth.challenge(buyer.address);
    now += 300001;
    await expect(auth.verify(challenge.challengeId, await buyer.signMessage({ message: challenge.message }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(() => auth.session(new Request(env.appOrigin))).toThrowError(expect.objectContaining({ code: "UNAUTHENTICATED" }));
    for (const origin of [undefined, "https://evil.invalid"]) expect(() => auth.assertOrigin(new Request(env.appOrigin, { headers: origin ? { origin } : {} }))).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => auth.assertOrigin(new Request(env.appOrigin, { headers: { origin: env.appOrigin } }))).not.toThrow();
  });
  it("bounds outstanding challenges and prunes expired challenge and session records", async () => {
    let now = 1000; const database = db(); const auth = new AuthService(database, env, () => now);
    const challenge = auth.challenge(buyer.address);
    const verified = await auth.verify(challenge.challengeId, await buyer.signMessage({ message: challenge.message }));
    for (let i = 0; i < 5; i++) auth.challenge(buyer.address);
    expect(() => auth.challenge(buyer.address)).toThrowError(expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }));
    now += 12 * 60 * 60_000 + 1;
    auth.challenge(buyer.address);
    expect(database.prepare("SELECT COUNT(*) AS count FROM auth_challenges").get()).toMatchObject({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get()).toMatchObject({ count: 0 });
    expect(() => auth.session(new Request(env.appOrigin, { headers: { cookie: verified.cookie.split(";")[0] } }))).toThrowError(expect.objectContaining({ code: "UNAUTHENTICATED" }));
  });
});

describe("immutable jobs and settlement access", () => {
  it("denies wrong buyer/unpaid execution and independently rejects wrong listing owner or service", async () => {
    const database = db(); const job = await unpaid(database);
    expect(() => service(database).get(other.address, job.id)).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
    await expect(new Runner(database, good, 1000).run(buyer.address, job.id)).rejects.toMatchObject({ code: "JOB_NOT_PAID" });
    for (const changed of [{ ownerAddress: other.address }, { serviceId: hash("9") }, { freshness: "stale" as const }, { active: false }]) await expect(service(database, { ...listing, ...changed }).create(buyer.address, listing.entityKey, "Hello")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(new JobService(database, config).create(buyer.address, listing.entityKey, "Hello")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    job.sourceSegments[0].text = "mutated";
    expect(() => saveJob(database, job)).toThrow(/immutable/);
  });
  it("records pending then verified idempotently and exposes settlement fields only to merchant", async () => {
    const database = db(); const job = await unpaid(database); let pending = true; let calls = 0;
    const payment = new PaymentService(database, async () => { calls++; return pending ? { pending: true } : { pending: false, blockNumber: "123" }; });
    expect((await payment.verify(buyer.address, job.id, hash("8"))).job.status).toBe("payment_pending");
    pending = false;
    expect((await payment.verify(buyer.address, job.id, hash("8"))).job.status).toBe("paid");
    await payment.verify(buyer.address, job.id, hash("8")); expect(calls).toBe(2);
    expect(() => listSettlements(database, buyer.address, config)).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    const csv = settlementCsv(listSettlements(database, merchant.address, config));
    expect(csv).toContain("amountAtomic"); expect(csv).not.toContain("Hello"); expect(csv).not.toContain("sourceSegments");
  });
  it("keeps original model output intact when edits are saved", async () => {
    const database = db(); const job = await paid(database);
    await new Runner(database, good, 1000).run(buyer.address, job.id);
    const original = service(database).get(buyer.address, job.id).modelSegments;
    const edited = service(database).edits(buyer.address, job.id, original!.map(s => ({ ...s, text: "बदला हुआ" })));
    expect(edited.modelSegments).toEqual(original); expect(edited.editedSegments![0].text).toBe("बदला हुआ");
    expect(() => service(database).edits(buyer.address, job.id, [])).toThrow();
  });
});

describe("durable execution", () => {
  it("dispatches once for concurrent requests and reopens the saved result", async () => {
    const database = db(); const job = await paid(database); let dispatches = 0; let complete!: () => void;
    const gate = new Promise<void>(resolve => { complete = resolve; });
    const provider: InferenceProvider = { assertReady() {}, async translate(source) { dispatches++; await gate; return good.translate(source); } };
    const runner = new Runner(database, provider, 1000);
    const first = runner.run(buyer.address, job.id);
    expect((await runner.run(buyer.address, job.id)).running).toBe(true);
    complete(); expect((await first).job.status).toBe("ready");
    expect((await runner.run(buyer.address, job.id)).job.status).toBe("ready"); expect(dispatches).toBe(1);
  });
  it("counts failed/uncertain dispatches and stops after the single manual retry", async () => {
    const database = db(); const job = await paid(database);
    const provider: InferenceProvider = { assertReady() {}, async translate() { throw new ServiceError("PROVIDER_UNAVAILABLE", 503, "Provider unavailable", true); } };
    const runner = new Runner(database, provider, 1000);
    await expect(runner.run(buyer.address, job.id)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(service(database).get(buyer.address, job.id)).toMatchObject({ attemptsUsed: 1, retryEligible: true, payment: { status: "verified" } });
    await expect(runner.run(buyer.address, job.id)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(runner.run(buyer.address, job.id)).rejects.toMatchObject({ code: "RETRY_NOT_ALLOWED" });
    expect(service(database).get(buyer.address, job.id).attemptsUsed).toBe(2);
  });
  it("rejects incomplete provider output without delivering partial data", async () => {
    const database = db(); const job = await paid(database);
    const provider: InferenceProvider = { assertReady() {}, async translate() { return { segments: [{ id: "seg_001", text: "अधूरा" }], evidence }; } };
    await expect(new Runner(database, provider, 1000).run(buyer.address, job.id)).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
    expect(service(database).get(buyer.address, job.id).modelSegments).toBeNull();
  });
  it("does not spend a second attempt on a nonretryable provider failure", async () => {
    const database = db(); const job = await paid(database);
    const provider: InferenceProvider = { assertReady() {}, async translate() { throw new ServiceError("PROVIDER_FAILED", 502, "Provider rejected this operation.", false); } };
    const runner = new Runner(database, provider, 1000);
    await expect(runner.run(buyer.address, job.id)).rejects.toMatchObject({ code: "PROVIDER_FAILED", retryable: false });
    expect(service(database).get(buyer.address, job.id)).toMatchObject({ attemptsUsed: 1, retryEligible: false });
    await expect(runner.run(buyer.address, job.id)).rejects.toMatchObject({ code: "RETRY_NOT_ALLOWED" });
  });
  it("preserves paid jobs across restart and only interrupts expired leases", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tool-city-test-")); dirs.push(dir); const path = join(dir, "jobs.sqlite");
    let database = openDatabase(path); const job = await paid(database);
    job.status = "running"; job.attemptsUsed = 1; saveJob(database, job);
    database.prepare("UPDATE jobs SET lease_token='test',lease_until=5000 WHERE id=?").run(job.id);
    database.prepare("INSERT INTO attempts VALUES(?,1,'test','running',5000,NULL,NULL)").run(job.id);
    database.close(); database = openDatabase(path); opened.push(database);
    expect(reconcileExpiredLeases(database, 4999)).toBe(0);
    expect(reconcileExpiredLeases(database, 5000)).toBe(1);
    expect(service(database).get(buyer.address, job.id)).toMatchObject({ status: "interrupted", retryEligible: true, attemptsUsed: 1, payment: { status: "verified" } });
  });
  it("reopens the completed original and edited result from disk after restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tool-city-ready-")); dirs.push(dir); const path = join(dir, "jobs.sqlite");
    let database = openDatabase(path); const job = await paid(database);
    await new Runner(database, good, 1000).run(buyer.address, job.id);
    const saved = service(database).edits(buyer.address, job.id, job.sourceSegments.map(s => ({ id: s.id, text: "सहेजा गया" })));
    database.close(); database = openDatabase(path); opened.push(database);
    expect(service(database).get(buyer.address, job.id)).toEqual(saved);
    expect((await new Runner(database, { assertReady() { throw new Error("Should not dispatch"); }, translate: good.translate }, 1000).run(buyer.address, job.id)).job).toEqual(saved);
  });
});

describe("private Router adapter", () => {
  it("pins private routing and verification while leaving absent evidence null", async () => {
    let sent!: RequestInit;
    const provider = createInferenceProvider(env, (async (_url, init) => { sent = init!; return Response.json({ choices: [{ message: { content: JSON.stringify({ segments: [{ id: "seg_001", text: "नमस्ते" }] }) } }] }); }) as typeof fetch);
    const result = await provider.translate([{ id: "seg_001", text: "Hello" }]);
    expect((sent.headers as Record<string, string>)["X-0G-Provider-Trust-Mode"]).toBe("private");
    expect((sent.headers as Record<string, string>)["X-0G-Provider-Allow-Fallbacks"]).toBe("false");
    expect(JSON.parse(sent.body as string).verify_tee).toBe(true);
    expect(result.evidence).toEqual(evidence);
  });
  it("fails closed on provider unavailability and reported weaker routing", async () => {
    const unavailable = createInferenceProvider(env, (async () => new Response("sensitive provider details", { status: 503 })) as typeof fetch);
    await expect(unavailable.translate([{ id: "seg_001", text: "Hello" }])).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", message: "Private translation provider could not complete the request." });
    const weak = createInferenceProvider(env, (async () => Response.json({ x_0g_trace: { trust_mode: "standard" }, choices: [{ message: { content: JSON.stringify({ segments: [{ id: "seg_001", text: "नमस्ते" }] }) } }] })) as typeof fetch);
    await expect(weak.translate([{ id: "seg_001", text: "Hello" }])).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
  });
  it("normalizes the documented x_0g_trace and rejects failed Router verification", async () => {
    const payload = { id: "chat-test", model: "test-model", x_0g_trace: { request_id: "test-request", provider: merchant.address, tee_verified: true }, choices: [{ message: { content: JSON.stringify({ segments: [{ id: "seg_001", text: "नमस्ते" }] }) } }] };
    const provider = createInferenceProvider(env, (async () => Response.json(payload)) as typeof fetch);
    expect((await provider.translate([{ id: "seg_001", text: "Hello" }])).evidence).toEqual({ requestId: "test-request", modelId: "test-model", providerId: merchant.address, routingTier: null, verificationRequested: true, routerTeeVerified: true });
    payload.x_0g_trace.tee_verified = false;
    await expect(provider.translate([{ id: "seg_001", text: "Hello" }])).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
  });
});

describe("receipt reconciliation", () => {
  it("treats a not-yet-mined receipt as pending without inventing payment evidence", async () => {
    const job = await unpaid(db());
    const client = { getChainId: async () => 1874, getTransactionReceipt: async () => { throw new TransactionReceiptNotFoundError({ hash: hash("8") }); } } as unknown as PublicClient;
    expect(await verifyOnchain(client, job, hash("8"), 3)).toEqual({ pending: true });
  });
  it("requires exact purchase event, token settlement, and contract entitlement", async () => {
    const database = db(); const job = await unpaid(database);
    const args = { buyer: buyer.address, jobId: job.id, serviceId: terms.serviceId, merchant: merchant.address, amount: BigInt(terms.amountAtomic), termsHash: terms.termsHash };
    const purchaseLog = { address: terms.checkoutAddress, topics: encodeEventTopics({ abi: checkoutAbi, eventName: "PurchaseMade", args: { buyer: buyer.address, jobId: job.id, serviceId: terms.serviceId } }), data: encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "bytes32" }], [merchant.address, BigInt(terms.amountAtomic), terms.termsHash]) };
    const transferAbi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);
    const transferLog = { address: terms.tokenAddress, topics: encodeEventTopics({ abi: transferAbi, eventName: "Transfer", args: { from: buyer.address, to: merchant.address } }), data: encodeAbiParameters([{ type: "uint256" }], [BigInt(terms.amountAtomic)]) };
    let logs = [purchaseLog, transferLog]; let purchaseBuyer: Address = buyer.address; let block = 102n;
    const client = { getChainId: async () => 1874, getTransactionReceipt: async () => ({ status: "success", from: buyer.address, to: terms.checkoutAddress, blockNumber: 100n, logs }), getBlockNumber: async () => block,
      readContract: async ({ functionName }: { functionName: string }) => ({ token: terms.tokenAddress, merchant: terms.merchantAddress, serviceId: terms.serviceId, amount: BigInt(terms.amountAtomic), termsHash: terms.termsHash, decimals: 6, getPurchase: { ...args, buyer: purchaseBuyer } })[functionName as "token"] } as unknown as PublicClient;
    expect(await verifyOnchain(client, job, hash("8"), 3)).toEqual({ pending: false, blockNumber: "100" });
    block = 101n; expect(await verifyOnchain(client, job, hash("8"), 3)).toEqual({ pending: true }); block = 102n;
    logs = [purchaseLog]; await expect(verifyOnchain(client, job, hash("8"), 3)).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    logs = [purchaseLog, transferLog]; purchaseBuyer = other.address; await expect(verifyOnchain(client, job, hash("8"), 3)).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
  });
});

describe("HTTP contract and unconfigured real mode", () => {
  it("returns exact envelopes, cookies and statuses and cannot enable payment through fixture rendering", async () => {
    delete process.env.SESSION_SECRET;
    expect(() => getServerEnv()).toThrowError(expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }));
    const publicConfig = await handle("config", new Request(`${env.appOrigin}/api/config`));
    expect(publicConfig.status).toBe(200); expect((await publicConfig.json()).data.configured).toBe(false);
    const unconfiguredSession = await handle("session", new Request(`${env.appOrigin}/api/auth/session`));
    expect(unconfiguredSession.status).toBe(503); expect((await unconfiguredSession.json()).error.code).toBe("SERVICE_UNAVAILABLE");
    process.env.SESSION_SECRET = env.sessionSecret;
    process.env.DATABASE_PATH = ":memory:";
    process.env.APP_ORIGIN = env.appOrigin;
    process.env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES = "true";
    const get = (path: string) => new Request(`${env.appOrigin}${path}`);
    const post = (path: string, data: unknown, cookie?: string, origin = env.appOrigin) => new Request(`${env.appOrigin}${path}`, { method: "POST", headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(data) });
    const missing = await handle("session", get("/api/auth/session"));
    expect(missing.status).toBe(401); expect(await missing.json()).toEqual({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue.", retryable: false } });
    const challengeResponse = await handle("challenge", get(`/api/auth/challenge?address=${buyer.address}`));
    const challenge = (await challengeResponse.json()).data as { challengeId: string; message: string; expiresAt: string };
    const signature = await buyer.signMessage({ message: challenge.message });
    expect((await handle("verifyAuth", post("/api/auth/verify", { challengeId: challenge.challengeId, signature }, undefined, "https://evil.invalid"))).status).toBe(403);
    const verified = await handle("verifyAuth", post("/api/auth/verify", { challengeId: challenge.challengeId, signature }));
    expect(verified.status).toBe(200); const cookie = verified.headers.get("set-cookie")!.split(";")[0]; expect(cookie).toContain("tool_city_session=");
    const session = await handle("session", new Request(`${env.appOrigin}/api/auth/session`, { headers: { cookie } }));
    expect((await session.json()).data.address).toBe(buyer.address);
    const created = await handle("createJob", post("/api/jobs", { workshopEntityKey: listing.entityKey, text: "Hello" }, cookie));
    expect(created.status).toBe(503); expect((await created.json()).error.code).toBe("SERVICE_UNAVAILABLE");
    const oversized = post("/api/jobs", { workshopEntityKey: listing.entityKey, text: "ह".repeat(16000) }, cookie);
    oversized.headers.set("content-length", "10"); // A false header must not bypass the actual byte limit.
    const tooLarge = await handle("createJob", oversized);
    expect(tooLarge.status).toBe(400); expect((await tooLarge.json()).error.code).toBe("BAD_INPUT");
    const declaredOversized = post("/api/jobs", {}, cookie); declaredOversized.headers.set("content-length", "1000000");
    expect((await handle("createJob", declaredOversized)).status).toBe(400);
    expect((await handle("job", new Request(`${env.appOrigin}/api/jobs/${hash("a")}`, { headers: { cookie } }), hash("a"))).status).toBe(404);
    expect((await handle("purchases", new Request(`${env.appOrigin}/api/merchant/purchases`, { headers: { cookie } }))).status).toBe(403);
    expect((await handle("logout", post("/api/auth/logout", {}, cookie))).status).toBe(200);
    expect((await handle("session", new Request(`${env.appOrigin}/api/auth/session`, { headers: { cookie } }))).status).toBe(401);
    delete process.env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES;
  });
});
