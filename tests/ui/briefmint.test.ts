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
import { BUILDING_BY_ID } from "../../src/components/city/scene-config";

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

test("briefStateToScene parks the worker at the Planning Desk when idle", () => {
  const home = BUILDING_BY_ID.home.waypoint;
  const idle = briefStateToScene(null);
  assert.equal(idle.building, "home", "no active brief parks at the Planning Desk");
  assert.deepEqual({ x: idle.x, y: idle.y }, home);
  assert.deepEqual({ x: briefStateToScene(brief({ executionStatus: "draft" })).x, y: briefStateToScene(brief({ executionStatus: "draft" })).y }, home);
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

// --- Truthful city: pure state mapping (PRD §5, §10, BM-15) ---
import {
  cityInputFromBrief,
  deriveCityState,
  NO_BRIEF_INPUT,
  type CityStateInput,
} from "../../src/components/city/city-state";
import {
  easeInOut,
  pathLength,
  pointAlong,
  streetRoute,
  walkDurationMs,
  JUNCTION,
  MAX_WALK_MS,
  MIN_WALK_MS,
  STREET_X,
  STREET_Y,
} from "../../src/components/city/walk-path";
import type { BriefFreshness, ExecutionStatus, PublicationStatus, ReviewStatus } from "../../src/lib/shared/briefmint";

const EXECUTIONS: Array<ExecutionStatus | null> = [null, "draft", "running", "ready", "failed", "interrupted"];
const REVIEWS: ReviewStatus[] = ["unreviewed", "approved"];
const PUBLICATIONS: PublicationStatus[] = ["unpublished", "pending", "live", "closed", "expired"];
const FRESHNESS: BriefFreshness[] = ["fresh", "stale", "unavailable"];

function allInputs(): CityStateInput[] {
  const out: CityStateInput[] = [];
  for (const execution of EXECUTIONS)
    for (const review of REVIEWS)
      for (const approvalCurrent of [false, true])
        for (const publication of PUBLICATIONS)
          for (const publicationConfirmed of [false, true])
            for (const freshness of FRESHNESS)
              for (const reopened of [false, true])
                out.push({
                  briefId: execution ? "b1" : null,
                  execution,
                  review,
                  approvalCurrent,
                  publication,
                  publicationConfirmed,
                  freshness,
                  observedAt: publicationConfirmed ? "2026-11-06T00:00:00Z" : null,
                  reopened,
                });
  return out;
}

const input = (over: Partial<CityStateInput>): CityStateInput => ({
  ...NO_BRIEF_INPUT,
  briefId: "b1",
  execution: "ready",
  ...over,
});

test("city mapping: worker location table", () => {
  const loc = (over: Partial<CityStateInput>) => deriveCityState(input(over)).worker;
  assert.equal(deriveCityState(NO_BRIEF_INPUT).worker.building, "home");
  assert.deepEqual(loc({ execution: "draft" }), { building: "home", pose: "working", carry: "notes", unresolved: false });
  assert.equal(loc({ execution: "running" }).building, "studio");
  assert.equal(loc({ execution: "ready" }).building, "treasury");
  const approved = { review: "approved" as const, approvalCurrent: true };
  assert.deepEqual(loc(approved), { building: "treasury", pose: "idle", carry: "brief", unresolved: false });
  assert.deepEqual(loc({ ...approved, publication: "pending" }), {
    building: "registry",
    pose: "waiting",
    carry: "brief",
    unresolved: false,
  });
  for (const publication of ["live", "closed"] as const) {
    assert.equal(loc({ ...approved, publication, publicationConfirmed: true }).building, "registry");
  }
  assert.equal(loc({ ...approved, reopened: true }).building, "archive");
  for (const execution of ["failed", "interrupted"] as const) {
    assert.deepEqual(loc({ execution }), { building: "studio", pose: "stalled", carry: "none", unresolved: true });
  }
});

test("city mapping: truthfulness invariants hold for every state combination", () => {
  const inputs = allInputs();
  assert.equal(inputs.length, 6 * 2 * 2 * 5 * 2 * 3 * 2);
  for (const i of inputs) {
    const s = deriveCityState(i);
    const ctx = JSON.stringify(i);
    // Determinism + serializability.
    assert.deepEqual(deriveCityState(i), s, ctx);
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, ctx);
    assert.ok(s.statusText.length > 0, ctx);
    // Live only with reconciled entity evidence and a fresh read.
    if (s.registry === "live") {
      assert.ok(i.publication === "live" && i.publicationConfirmed && i.freshness === "fresh", ctx);
    }
    if (i.publication === "live" && !i.publicationConfirmed) assert.equal(s.registry, "pending", ctx);
    // Expired/closed only from a fresh confirmed query; failed reads are stale/unavailable.
    if (s.registry === "expired") assert.ok(i.publication === "expired" && i.freshness === "fresh", ctx);
    if (s.registry === "closed") assert.ok(i.publication === "closed" && i.freshness === "fresh", ctx);
    if (i.freshness !== "fresh" && ["live", "closed", "expired"].includes(i.publication) && s.registry !== "pending") {
      assert.equal(s.registry, i.freshness, ctx);
    }
    if (i.publication === "unpublished") assert.equal(s.registry, "none", ctx);
    // Approved visuals only for the current approved, ready revision.
    if (s.release === "approved") {
      assert.ok(i.execution === "ready" && i.review === "approved" && i.approvalCurrent, ctx);
    }
    // Running is the only state that animates the studio as working.
    assert.equal(s.studio === "running", i.execution === "running", ctx);
    // Failed/interrupted never look resolved or successful.
    if (i.execution === "failed" || i.execution === "interrupted") {
      assert.equal(s.worker.pose, "stalled", ctx);
      assert.equal(s.worker.unresolved, true, ctx);
      assert.equal(s.studio, i.execution, ctx);
      assert.notEqual(s.release, "approved", ctx);
    } else {
      assert.equal(s.worker.unresolved, false, ctx);
      assert.notEqual(s.worker.pose, "stalled", ctx);
    }
    // Waiting pose only for pending publication of a ready brief.
    if (s.worker.pose === "waiting") assert.equal(s.registry, "pending", ctx);
    if (i.execution === "ready" && s.registry === "pending") assert.equal(s.worker.building, "registry", ctx);
    if (i.execution === null) assert.equal(s.worker.building, "home", ctx);
    // Quest marker: never on running work; warn only for unresolved work or bad reads.
    if (i.execution === "running") assert.equal(s.quest, null, ctx);
    if (s.quest?.kind === "warn") {
      assert.ok(s.worker.unresolved || s.registry === "stale" || s.registry === "unavailable", ctx);
    }
    if (s.quest?.kind === "wait") assert.equal(s.registry, "pending", ctx);
    if (s.worker.unresolved) assert.deepEqual(s.quest, { building: "studio", kind: "warn" }, ctx);
  }
});

test("city mapping: quest marker points at the next real step", () => {
  const q = (over: Partial<CityStateInput>) => deriveCityState(input(over)).quest;
  assert.deepEqual(deriveCityState(NO_BRIEF_INPUT).quest, { building: "home", kind: "action" });
  assert.deepEqual(q({ execution: "draft" }), { building: "studio", kind: "action" });
  assert.equal(q({ execution: "running" }), null);
  assert.deepEqual(q({}), { building: "treasury", kind: "action" });
  const approved = { review: "approved" as const, approvalCurrent: true };
  assert.deepEqual(q(approved), { building: "registry", kind: "action" });
  assert.deepEqual(q({ ...approved, publication: "pending" }), { building: "registry", kind: "wait" });
  assert.equal(q({ ...approved, publication: "live", publicationConfirmed: true }), null);
  assert.deepEqual(q({ ...approved, publication: "live", publicationConfirmed: true, freshness: "stale" }), {
    building: "registry",
    kind: "warn",
  });
});

test("city mapping: adapter from PrivateBrief", () => {
  assert.deepEqual(cityInputFromBrief(null), NO_BRIEF_INPUT);
  const live = brief({
    reviewStatus: "approved",
    draftRevision: 2,
    approval: {
      briefId: "brief-test-1",
      draftRevision: 1,
      canonicalPublicPayload: projectPublicPayload(brief()),
      publicPayloadHash: hashPublicPayload(projectPublicPayload(brief())),
      approvedBy: "0x1111111111111111111111111111111111111111",
      approvedAt: new Date().toISOString(),
    },
  });
  // Edit after approval (revision 2 vs approved 1): approval is not current.
  assert.equal(cityInputFromBrief(live).approvalCurrent, false);
  assert.equal(deriveCityState(cityInputFromBrief(live)).release, "awaiting");
  // A tx hash alone is not live.
  const txOnly = brief({
    publication: { ...brief().publication, lastObservedStatus: "live", lastConfirmedTxHash: "0xaa", entityKey: null },
  });
  assert.equal(deriveCityState(cityInputFromBrief(txOnly)).registry, "pending");
});

test("walk path: routes stay on streets and timing is proportional", () => {
  const home = BUILDING_BY_ID.home.waypoint;
  const studio = BUILDING_BY_ID.studio.waypoint;
  const desk = BUILDING_BY_ID.treasury.waypoint;
  const r1 = streetRoute(home, studio);
  assert.deepEqual(r1, [home, { x: home.x, y: STREET_Y }, { x: studio.x, y: STREET_Y }, studio]);
  const r2 = streetRoute(home, desk);
  assert.ok(r2.some((p) => p.x === JUNCTION.x && p.y === JUNCTION.y));
  assert.deepEqual(r2[r2.length - 2], { x: STREET_X, y: desk.y });
  // Every interior segment is axis-aligned (along a street).
  for (const r of [r1, r2, streetRoute(desk, BUILDING_BY_ID.archive.waypoint)]) {
    for (let k = 2; k < r.length - 1; k++) assert.ok(r[k].x === r[k - 1].x || r[k].y === r[k - 1].y);
  }
  assert.deepEqual(streetRoute(home, home), [home]);
  assert.equal(walkDurationMs(0), 0);
  assert.equal(walkDurationMs(1), MIN_WALK_MS);
  assert.equal(walkDurationMs(1e6), MAX_WALK_MS);
  assert.equal(walkDurationMs(140), 2000);
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.ok(Math.abs(easeInOut(0.5) - 0.5) < 1e-9);
  const mid = pointAlong(r1, 0.5);
  assert.ok(Math.abs(pathLength(r1) / 2 - (Math.abs(mid.x - home.x) + Math.abs(home.y - STREET_Y))) < 1e-6);
  assert.equal(mid.dx, 1);
  assert.deepEqual(pointAlong(r1, 1), { x: studio.x, y: studio.y, dx: 0 });
  assert.deepEqual(streetRoute(home, studio), r1);
});
