// BriefMint UI smoke checks — pure, dependency-light contract tests.
// Covers: notes/params validation, canonical payload hash stability, approval
// invalidation on edit, public allowlist (no private fields), opportunity
// text filtering, and the BriefMint city mapper. No network, no wallet.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { OpportunityView, PrivateBrief, PublicParameters } from "../../src/lib/shared/briefmint";
import {
  assertPublicPayloadClean,
  briefSegmentIds,
  canonicalizePublicPayload,
  countWords,
  filterOpportunities,
  hashPublicPayload,
  isApprovalCurrent,
  projectPublicPayload,
  splitBriefSegments,
  validateBriefNotes,
  validatePublicParameters,
  MAX_BRIEF_CHARS,
  MAX_BRIEF_SEGMENTS,
  MAX_BRIEF_WORDS,
} from "../../src/lib/shared/briefmint-validation";
import { briefStateToScene } from "../../src/components/city/brief-state-to-scene";
import { PLAZA } from "../../src/components/city/scene-config";

const params = (over: Partial<PublicParameters> = {}): PublicParameters => ({
  category: "writing",
  title: "Launch graphics",
  summary: "Short launch explainer for the community.",
  budgetCentsPresent: false,
  budgetCents: null,
  contactUrl: null,
  deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  language: "en",
  ...over,
});

const brief = (over: Partial<PrivateBrief> = {}): PrivateBrief => ({
  id: "brief-test-1",
  ownerAddress: "0x1111111111111111111111111111111111111111",
  inputSegments: [{ id: "seg_001", text: "Ship the launch post by Friday." }],
  publicParameters: params(),
  executionStatus: "ready",
  reviewStatus: "unreviewed",
  attemptsUsed: 1,
  retryEligible: false,
  immutableModelResult: {
    deliverables: [{ id: "d1", text: "Launch post draft", sourceRefs: ["seg_001"] }],
    acceptanceCriteria: [{ id: "a1", text: "Mentions date and scope", sourceRefs: ["seg_001"] }],
    exclusions: [],
    openQuestions: [{ id: "q1", text: "Which channels?", sourceRefs: [] }],
  },
  editedDraft: null,
  draftRevision: 1,
  approval: null,
  publication: {
    briefId: "brief-test-1",
    entityKey: null,
    publicRevision: null,
    pendingTxHash: null,
    lastConfirmedTxHash: null,
    observedPayloadHash: null,
    expiresAtBlock: null,
    lastObservedStatus: "unpublished",
    observedAt: null,
    freshness: "unavailable",
  },
  inferenceEvidence: null,
  error: null,
  createdAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
  ...over,
});

test("notes bounds: empty rejected, 250 words ok, 251 rejected", () => {
  assert.equal(validateBriefNotes("   ").ok, false);
  const words = Array.from({ length: 250 }, (_, i) => `w${i}`).join(" ");
  assert.deepEqual(validateBriefNotes(words), { ok: true });
  assert.equal(validateBriefNotes(`${words} extra`).ok, false);
  assert.equal(validateBriefNotes("a".repeat(MAX_BRIEF_CHARS + 1)).ok, false);
  assert.equal(MAX_BRIEF_WORDS, 250);
  assert.equal(MAX_BRIEF_SEGMENTS, 20);
});

test("segments split on blank paragraphs with stable seg_NNN ids", () => {
  assert.deepEqual(splitBriefSegments("a\n\n\nb\n\n  \n\nc"), ["a", "b", "c"]);
  assert.deepEqual(briefSegmentIds(2), ["seg_001", "seg_002"]);
  assert.equal(countWords("  hello   world\n"), 2);
});

test("public params reject bad category/budget/contact/deadline", () => {
  assert.deepEqual(validatePublicParameters(params()), { ok: true });
  assert.equal(validatePublicParameters(params({ category: "video" as never })).ok, false);
  assert.equal(validatePublicParameters(params({ budgetCentsPresent: true, budgetCents: 1.5 })).ok, false);
  assert.equal(validatePublicParameters(params({ contactUrl: "http://x.example" })).ok, false);
  assert.equal(validatePublicParameters(params({ contactUrl: "https://example.org/apply" })).ok, true);
  assert.equal(validatePublicParameters(params({ deadline: new Date(Date.now() - 1000).toISOString() })).ok, false);
  assert.equal(validatePublicParameters(params({ deadline: new Date(Date.now() + 30 * 24 * 3600_000).toISOString() })).ok, false);
});

test("canonical payload hash is stable and approval invalidates on edit", () => {
  const b = brief();
  const p1 = projectPublicPayload(b);
  assert.equal(canonicalizePublicPayload(p1), canonicalizePublicPayload({ ...p1 }));
  const h1 = hashPublicPayload(p1);
  assert.match(h1, /^0x[0-9a-fA-F]{64}$/);
  const approved: PrivateBrief = {
    ...b,
    reviewStatus: "approved",
    approval: {
      briefId: b.id,
      draftRevision: 1,
      canonicalPublicPayload: p1,
      publicPayloadHash: h1,
      approvedBy: b.ownerAddress,
      approvedAt: new Date().toISOString(),
    },
  };
  assert.equal(isApprovalCurrent(approved), true);
  // Any public-content edit bumps the revision and invalidates approval.
  const edited: PrivateBrief = {
    ...approved,
    draftRevision: 2,
    editedDraft: {
      deliverables: [{ id: "d1", text: "Changed scope", sourceRefs: ["seg_001"] }],
      acceptanceCriteria: approved.immutableModelResult!.acceptanceCriteria,
      exclusions: [],
      openQuestions: [],
    },
  };
  assert.equal(isApprovalCurrent(edited), false);
  assertPublicPayloadClean(p1);
});

test("public projection carries allowlist only — no private fields", () => {
  const b = brief();
  const p = projectPublicPayload(b);
  const keys = Object.keys(p).sort();
  assert.deepEqual(keys, [
    "acceptanceCriteria",
    "budgetCents",
    "category",
    "contactUrl",
    "deadline",
    "deliverables",
    "exclusions",
    "language",
    "openQuestions",
    "revision",
    "schemaVersion",
    "summary",
    "title",
  ]);
  const blob = JSON.stringify(p);
  assert.ok(!blob.includes("seg_001"), "source IDs must not leak into the public payload");
  assert.ok(!blob.includes("brief-test-1"), "private database IDs must not leak");
});

test("opportunity text filter narrows without inventing records", () => {
  const mk = (title: string, summary: string): OpportunityView => ({
    entityKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ownerAddress: "0x1111111111111111111111111111111111111111",
    title,
    summary,
    category: "writing",
    language: "en",
    status: "open",
    budgetCents: null,
    contactUrl: null,
    deadline: new Date(Date.now() + 3600_000).toISOString(),
    revision: 1,
    expiresAtBlock: null,
    fetchedAt: new Date().toISOString(),
    freshness: "fresh",
  });
  const list = [mk("Launch graphics", "community post"), mk("Explainer design", "visual guide")];
  assert.equal(filterOpportunities(list, { query: "graphics" }).length, 1);
  assert.equal(filterOpportunities(list, { query: "nope-nothing" }).length, 0);
  assert.equal(filterOpportunities(list, {}).length, 2);
});

test("briefStateToScene maps workflow state to buildings, idle to plaza", () => {
  assert.deepEqual({ x: briefStateToScene(null).x, y: briefStateToScene(null).y }, PLAZA);
  assert.equal(briefStateToScene(brief({ executionStatus: "draft" })).building, "home");
  assert.equal(briefStateToScene(brief({ executionStatus: "running" })).building, "studio");
  assert.equal(briefStateToScene(brief({ executionStatus: "ready" })).building, "treasury");
  const approvedLive = brief({
    executionStatus: "ready",
    reviewStatus: "approved",
    approval: {
      briefId: "brief-test-1",
      draftRevision: 1,
      canonicalPublicPayload: projectPublicPayload(brief()),
      publicPayloadHash: hashPublicPayload(projectPublicPayload(brief())),
      approvedBy: "0x1111111111111111111111111111111111111111",
      approvedAt: new Date().toISOString(),
    },
    publication: {
      briefId: "brief-test-1",
      entityKey: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      publicRevision: 1,
      pendingTxHash: null,
      lastConfirmedTxHash: null,
      observedPayloadHash: null,
      expiresAtBlock: "123",
      lastObservedStatus: "live",
      observedAt: new Date().toISOString(),
      freshness: "fresh",
    },
  });
  assert.equal(briefStateToScene(approvedLive).building, "registry");
  assert.equal(briefStateToScene(brief({ executionStatus: "failed", error: { code: "PROVIDER_FAILED", message: "x" } })).unresolved, true);
});
