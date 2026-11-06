import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertBriefDeadline, arkivTransactionSchema, briefApi, briefCandidateSchema, briefmintConfigSchema,
  BRIEF_LIMITS, BRIEF_KIND, BRIEFMINT_CHAIN_ID, OPPORTUNITY_NAMESPACE,
  canonicalPublicJson, createBriefRequestSchema, hashPublicOpportunity,
  projectPublicOpportunity, publicationIntentSchema, publicationSchema,
  splitBriefNotes, validateBriefApproval, validateModelResult, validatePublicationApproval, validatePublicationIntent,
  type BriefCandidate, type BriefView,
} from "../../src/lib/shared/briefs";

const id = `0x${"a".repeat(64)}`;
const owner = `0x${"1".repeat(40)}`;
const now = Date.parse("2026-11-06T00:00:00.000Z");
const candidate: BriefCandidate = {
  parameters: { title: "Community launch graphics", summary: "Create launch graphics.", category: "design",
    language: "en", budgetUsdCents: null, deadline: "2026-11-07T00:00:00.000Z", contactUrl: null },
  sections: { deliverables: ["Three graphics"], acceptanceCriteria: ["Editable source included"], exclusions: [], openQuestions: [] },
  status: "open",
};
function ready(): BriefView {
  const item = { text: "Three graphics", sourceIds: ["seg_001"], basis: "provided" as const };
  return {
    schemaVersion: 1, kind: BRIEF_KIND, id, ownerAddress: owner,
    inputSegments: [{ id: "seg_001", text: "PRIVATE canary" }], publicParameters: candidate.parameters,
    executionStatus: "ready", attemptsUsed: 1, retryEligible: false,
    immutableModelResult: { deliverables: [item], acceptanceCriteria: [item], exclusions: [], openQuestions: [] },
    editedDraft: structuredClone(candidate), draftRevision: 1, evidence: null, error: null,
    review: { status: "unreviewed", approval: null },
    publication: { status: "unpublished", freshness: "unavailable", confirmed: null, pending: null },
    createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
  };
}

describe("BriefMint strict boundaries", () => {
  it("rejects unknown/private/authority fields at every request boundary", () => {
    for (const endpoint of Object.values(briefApi)) {
      expect(endpoint.request.safeParse({ ownerAddress: owner, paid: true }).success).toBe(false);
    }
    expect(createBriefRequestSchema.parse({ notes: "Private notes", publicParameters: candidate.parameters }).notes).toBe("Private notes");
    expect(() => createBriefRequestSchema.parse({ notes: "Private notes", publicParameters: { ...candidate.parameters, funded: true } })).toThrow();
    expect(() => briefCandidateSchema.parse({ ...candidate, sourceIds: ["seg_001"] })).toThrow();
  });
  it("bounds input and assigns stable paragraph IDs without accepting caller IDs", () => {
    expect(splitBriefNotes("One\n\nTwo")).toEqual([{ id: "seg_001", text: "One" }, { id: "seg_002", text: "Two" }]);
    for (const notes of ["", " leading", "word ".repeat(250) + "extra", "x".repeat(5001), Array(21).fill("p").join("\n\n")]) {
      expect(() => splitBriefNotes(notes)).toThrow();
    }
  });
  it("rejects invented source IDs and keeps suggested versus provided explicit", () => {
    const model = ready().immutableModelResult!;
    expect(validateModelResult(model, ready().inputSegments)).toEqual(model);
    expect(() => validateModelResult(model, [{ id: "seg_002", text: "other" }])).toThrow();
    expect(() => validateModelResult({ ...model, deliverables: [{ text: "Fact", sourceIds: [], basis: "provided" }] }, [])).toThrow();
    expect(validateModelResult({ ...model, deliverables: [{ text: "Suggestion", sourceIds: [], basis: "suggested" }] }, ready().inputSegments).deliverables[0].basis).toBe("suggested");
  });
  it("requires safe amounts, explicit nulls, HTTPS and time-aware deadline checks", () => {
    for (const patch of [{ budgetUsdCents: 1.5 }, { budgetUsdCents: -1 }, { budgetUsdCents: Number.MAX_SAFE_INTEGER + 1 },
      { budgetUsdCents: undefined }, { contactUrl: "javascript:alert(1)" }, { contactUrl: "https://user:pass@example.com" }, { language: "hi" }]) {
      expect(() => briefCandidateSchema.parse({ ...candidate, parameters: { ...candidate.parameters, ...patch } })).toThrow();
    }
    assertBriefDeadline(candidate.parameters.deadline, now);
    expect(() => assertBriefDeadline(new Date(now).toISOString(), now)).toThrow();
    expect(() => assertBriefDeadline(new Date(now + 7 * 86400000 + 1).toISOString(), now)).toThrow();
  });
  it("validates response envelopes and keeps missing evidence unknown", () => {
    expect(briefApi.get.response.parse({ ok: true, data: ready() })).toMatchObject({ data: { evidence: null } });
    expect(briefApi.get.response.safeParse({ ok: true, data: { ...ready(), privateKey: "bad" } }).success).toBe(false);
    expect(briefApi.get.response.safeParse({ ok: true, data: { ...ready(), immutableModelResult: null } }).success).toBe(false);
    expect(briefApi.get.response.parse({ ok: false, error: { code: "NOT_FOUND", message: "Brief not found.", retryable: false } }).ok).toBe(false);
  });
  it("config cannot enable checkout or silently substitute another chain", () => {
    const readiness = { available: false, reason: "Not configured" };
    const config = { schemaVersion: 1, kind: BRIEF_KIND, namespace: OPPORTUNITY_NAMESPACE,
      auth: { chainId: BRIEFMINT_CHAIN_ID, challengePurpose: "briefmint", readiness }, compilation: readiness,
      arkiv: { chainId: BRIEFMINT_CHAIN_ID, readiness }, limits: BRIEF_LIMITS,
      quota: { policy: "allowlisted-demo", maxAttemptsPerBrief: 2, maxConcurrent: 1, compilationsPerWallet: null, globalDispatchLimit: null, windowEndsAt: null } };
    expect(briefmintConfigSchema.parse(config)).toEqual(config);
    expect(() => briefmintConfigSchema.parse({ ...config, terms: {} })).toThrow();
    expect(() => briefmintConfigSchema.parse({ ...config, auth: { ...config.auth, chainId: 1874 } })).toThrow();
    expect(() => briefmintConfigSchema.parse({ ...config, compilation: { available: true, reason: null } })).toThrow();
  });
  it("rejects invalid persisted source references and confirmed receipts without chain evidence", () => {
    const brief = ready();
    brief.inputSegments = [{ id: "seg_002", text: "Other source" }];
    expect(briefApi.get.response.safeParse({ ok: true, data: brief }).success).toBe(false);
    brief.inputSegments = [ready().inputSegments[0], ready().inputSegments[0]];
    expect(briefApi.get.response.safeParse({ ok: true, data: brief }).success).toBe(false);
    expect(arkivTransactionSchema.safeParse({ status: "confirmed", chainId: BRIEFMINT_CHAIN_ID, signer: null, entityKeys: [], blockNumber: null }).success).toBe(false);
  });
});

describe("canonical approval and public isolation", () => {
  it("has a fixed public allowlist and excludes private record/evidence/source metadata", () => {
    const payload = projectPublicOpportunity(ready().editedDraft!, 1);
    expect(Object.keys(payload).sort()).toEqual(["schemaVersion", "namespace", "revision", "title", "summary", "category", "language",
      "budgetUsdCents", "deadline", "contactUrl", "deliverables", "acceptanceCriteria", "exclusions", "openQuestions", "status"].sort());
    expect(JSON.stringify(payload)).not.toMatch(/PRIVATE|seg_001|ownerAddress|evidence/);
    const injected = { ...payload, notes: "PRIVATE" };
    expect(() => canonicalPublicJson(injected)).toThrow();
    // Allowlisting is structural, not semantic redaction: approved text is public verbatim.
    expect(projectPublicOpportunity({ ...candidate, parameters: { ...candidate.parameters, title: "PRIVATE intentionally approved" } }, 1).title).toContain("PRIVATE");
  });
  it("canonicalizes key order and matches an independent SHA-256 implementation", async () => {
    const payload = projectPublicOpportunity(candidate, 1);
    const reversed = Object.fromEntries(Object.entries(payload).reverse()) as typeof payload;
    const canonical = canonicalPublicJson(payload);
    expect(canonical).toBe('{"acceptanceCriteria":["Editable source included"],"budgetUsdCents":null,"category":"design","contactUrl":null,"deadline":"2026-11-07T00:00:00.000Z","deliverables":["Three graphics"],"exclusions":[],"language":"en","namespace":"tool-city.opportunity.v1","openQuestions":[],"revision":1,"schemaVersion":1,"status":"open","summary":"Create launch graphics.","title":"Community launch graphics"}');
    expect(canonicalPublicJson(reversed)).toBe(canonical);
    expect(await hashPublicOpportunity(payload)).toBe(`0x${createHash("sha256").update(canonical, "utf8").digest("hex")}`);
    expect(await hashPublicOpportunity({ ...payload, revision: 2 })).not.toBe(await hashPublicOpportunity(payload));
    expect(await hashPublicOpportunity({ ...payload, status: "closed" })).not.toBe(await hashPublicOpportunity(payload));
  });
  it("rejects stale revisions, changed content and unapproved publication", async () => {
    const brief = ready(); const hash = await hashPublicOpportunity(projectPublicOpportunity(candidate, 1));
    await expect(validateBriefApproval(brief, 1, hash)).resolves.toMatchObject({ revision: 1 });
    await expect(validateBriefApproval(brief, 2, hash)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(validateBriefApproval({ ...brief, executionStatus: "running" }, 1, hash)).rejects.toMatchObject({ code: "BRIEF_NOT_READY" });
    await expect(validatePublicationApproval(brief, 1, hash)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    brief.review = { status: "approved", approval: { draftRevision: 1, publicPayloadHash: hash, canonicalPublicPayload: projectPublicOpportunity(candidate, 1), approvedBy: owner, approvedAt: brief.updatedAt } };
    await expect(validatePublicationApproval(brief, 1, hash)).resolves.toBeDefined();
    brief.editedDraft!.parameters.title = "Changed";
    await expect(validatePublicationApproval(brief, 1, hash)).rejects.toMatchObject({ code: "PAYLOAD_MISMATCH" });
  });
  it("bounds serialized UTF-8 public content, including multi-byte strings", () => {
    const huge = { ...candidate, sections: { ...candidate.sections, deliverables: Array(12).fill("界".repeat(500)) } };
    expect(() => projectPublicOpportunity(huge, 1)).toThrow(/16000/);
  });
  it("retains older approved intent while newer private drafts need a new approval", async () => {
    const payload = projectPublicOpportunity(candidate, 1); const hash = await hashPublicOpportunity(payload);
    const intent = publicationIntentSchema.parse({ intentId: id, operation: "create", chainId: BRIEFMINT_CHAIN_ID,
      ownerAddress: owner, entityKey: null, basePayloadHash: null, payload, publicPayloadHash: hash,
      expiresAtBlock: "9999", createdAt: new Date(now).toISOString() });
    await expect(validatePublicationIntent(intent)).resolves.toEqual(intent);
    await expect(validatePublicationIntent({ ...intent, publicPayloadHash: id })).rejects.toMatchObject({ code: "PAYLOAD_MISMATCH" });
    const brief = ready(); brief.draftRevision = 2; brief.editedDraft!.parameters.title = "New draft";
    brief.publication = { status: "pending", freshness: "unavailable", confirmed: null, pending: { intent, transactionHash: id } };
    expect(briefApi.get.response.parse({ ok: true, data: brief })).toMatchObject({ data: { draftRevision: 2, publication: { pending: { intent: { payload: { revision: 1 } } } } } });
    expect(() => publicationIntentSchema.parse({ ...intent, operation: "update" })).toThrow();
    expect(() => publicationIntentSchema.parse({ ...intent, operation: "close" })).toThrow();
    expect(() => publicationSchema.parse({ ...brief.publication, status: "live" })).toThrow();
  });
});
