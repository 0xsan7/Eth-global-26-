// BriefMint UI smoke checks — pure, dependency-light contract tests.
// Covers: canonical notes/params validation, canonical payload hash stability,
// revision-bound approval, public allowlist (no private fields), opportunity
// text filtering, and the BriefMint city mapper. No network, no wallet.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIEF_LIMITS,
  canonicalPublicJson,
  hashPublicOpportunity,
  privateNotesSchema,
  projectPublicOpportunity,
  publicParametersSchema,
  splitBriefNotes,
  toOpportunityView,
  validateBriefApproval,
  type BriefCandidate,
  type BriefView,
  type OpportunityRecord,
  type OpportunityView,
  type PublicOpportunity,
} from "../../src/lib/shared/briefmint";
import {
  briefSegmentIds,
  countWords,
  filterOpportunities,
  MAX_SUMMARY_CHARS,
  MAX_TITLE_CHARS,
  splitBriefSegments,
} from "../../src/lib/shared/briefmint-validation";
import { briefStateToScene } from "../../src/components/city/brief-state-to-scene";
import { BUILDING_BY_ID } from "../../src/components/city/scene-config";

const OWNER = "0x1111111111111111111111111111111111111111";
const ID = `0x${"a1".repeat(32)}`;
const NOW = () => new Date().toISOString();

const params = (over: Record<string, unknown> = {}) => ({
  category: "writing" as const,
  title: "Launch graphics",
  summary: "Short launch explainer for the community.",
  language: "en" as const,
  budgetUsdCents: null as number | null,
  deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  contactUrl: null as string | null,
  ...over,
});

const candidate = (over: Partial<BriefCandidate> = {}): BriefCandidate => ({
  parameters: params(),
  sections: {
    deliverables: ["Launch post draft"],
    acceptanceCriteria: ["Mentions date and scope"],
    exclusions: [],
    openQuestions: ["Which channels?"],
  },
  status: "open" as const,
  ...over,
});

const brief = (over: Record<string, unknown> = {}): BriefView => ({
  schemaVersion: 1 as const,
  kind: "brief.compile.v1" as const,
  id: ID,
  ownerAddress: OWNER,
  inputSegments: [{ id: "seg_001", text: "Ship the launch post by Friday." }],
  publicParameters: params(),
  executionStatus: "ready" as const,
  attemptsUsed: 1,
  retryEligible: false,
  immutableModelResult: {
    deliverables: [{ text: "Launch post draft", sourceIds: ["seg_001"], basis: "provided" as const }],
    acceptanceCriteria: [{ text: "Mentions date and scope", sourceIds: ["seg_001"], basis: "provided" as const }],
    exclusions: [],
    openQuestions: [{ text: "Which channels?", sourceIds: [], basis: "suggested" as const }],
  },
  editedDraft: null,
  draftRevision: 1,
  evidence: null,
  error: null,
  review: { status: "unreviewed" as const, approval: null },
  publication: { status: "unpublished" as const, freshness: "unavailable" as const, confirmed: null, pending: null },
  createdAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
  ...over,
} as BriefView);

test("notes bounds: empty rejected, 250 words ok, 251 rejected", () => {
  assert.equal(privateNotesSchema.safeParse("   ").success, false);
  const words = Array.from({ length: 250 }, (_, i) => `w${i}`).join(" ");
  assert.equal(privateNotesSchema.safeParse(words).success, true);
  assert.equal(privateNotesSchema.safeParse(`${words} extra`).success, false);
  assert.equal(privateNotesSchema.safeParse("a".repeat(BRIEF_LIMITS.maxChars + 1)).success, false);
  assert.equal(BRIEF_LIMITS.maxWords, 250);
  assert.equal(BRIEF_LIMITS.maxParagraphs, 20);
  assert.deepEqual(splitBriefNotes("a\n\nb").map((s) => s.id), ["seg_001", "seg_002"]);
});

test("segments split on blank paragraphs with stable seg_NNN ids", () => {
  assert.deepEqual(splitBriefSegments("a\n\n\nb\n\n  \n\nc"), ["a", "b", "c"]);
  assert.deepEqual(briefSegmentIds(2), ["seg_001", "seg_002"]);
  assert.equal(countWords("  hello   world\n"), 2);
});

test("public params reject bad category/budget/contact/deadline", async () => {
  assert.equal(publicParametersSchema.safeParse(params()).success, true);
  assert.equal(publicParametersSchema.safeParse(params({ category: "video" })).success, false);
  assert.equal(publicParametersSchema.safeParse(params({ budgetUsdCents: 1.5 })).success, false);
  assert.equal(publicParametersSchema.safeParse(params({ contactUrl: "http://x.example" })).success, false);
  assert.equal(publicParametersSchema.safeParse(params({ contactUrl: "https://example.org/apply" })).success, true);
  assert.equal(publicParametersSchema.safeParse(params({ title: "x".repeat(MAX_TITLE_CHARS + 1) })).success, false);
  assert.equal(publicParametersSchema.safeParse(params({ summary: "x".repeat(MAX_SUMMARY_CHARS + 1) })).success, false);
  assert.equal(MAX_TITLE_CHARS, 120);
  assert.equal(MAX_SUMMARY_CHARS, 1000);
  // Temporal deadline rule lives in assertBriefDeadline (create/save/approve/prepare), not the shape schema.
  const { assertBriefDeadline } = await import("../../src/lib/shared/briefmint");
  const now = Date.now();
  assert.doesNotThrow(() => assertBriefDeadline(new Date(now + 3600_000).toISOString(), now));
  assert.throws(() => assertBriefDeadline(new Date(now - 1000).toISOString(), now), /Deadline/);
  assert.throws(() => assertBriefDeadline(new Date(now + 30 * 24 * 3600_000).toISOString(), now), /Deadline/);
});

test("canonical payload hash is stable and approval binds the revision", async () => {
  const b = brief();
  assert.ok(b.editedDraft === null);
  const cand = { ...candidate(), parameters: params() };
  const p1 = projectPublicOpportunity(cand, 2);
  assert.equal(canonicalPublicJson(p1), canonicalPublicJson({ ...p1 }));
  const h1 = await hashPublicOpportunity(p1);
  assert.match(h1, /^0x[0-9a-f]{64}$/);
  assert.equal(await hashPublicOpportunity(p1), h1);
  const approved = brief({
    editedDraft: cand,
    draftRevision: 2,
    review: {
      status: "approved",
      approval: {
        draftRevision: 2,
        publicPayloadHash: h1,
        canonicalPublicPayload: p1,
        approvedBy: OWNER,
        approvedAt: NOW(),
      },
    },
  });
  assert.deepEqual(await validateBriefApproval(approved, 2, h1), p1);
  // A stale revision or hash fails closed.
  await assert.rejects(validateBriefApproval(approved, 3, h1), /REVISION_CONFLICT/);
  await assert.rejects(validateBriefApproval(approved, 2, `0x${"00".repeat(32)}`), /PAYLOAD_MISMATCH/);
});

test("public projection carries allowlist only — no private fields", () => {
  const p: PublicOpportunity = projectPublicOpportunity(candidate(), 1);
  const keys = Object.keys(p).sort();
  assert.deepEqual(keys, [
    "acceptanceCriteria",
    "budgetUsdCents",
    "category",
    "contactUrl",
    "deadline",
    "deliverables",
    "exclusions",
    "language",
    "namespace",
    "openQuestions",
    "revision",
    "schemaVersion",
    "status",
    "summary",
    "title",
  ]);
  const blob = JSON.stringify(p);
  assert.ok(!blob.includes("seg_001"), "source IDs must not leak into the public payload");
  assert.ok(!blob.includes("brief-test-1"), "private database IDs must not leak");
});

test("opportunity view projects the canonical record without inventing data", () => {
  const payload = projectPublicOpportunity(candidate(), 1);
  const record: OpportunityRecord = {
    entityKey: `0x${"ab".repeat(32)}`,
    ownerAddress: OWNER,
    payload,
    expiresAtBlock: "123",
    observedAtBlock: "120",
    observedAt: NOW(),
  };
  const view = toOpportunityView(record);
  assert.equal(view.title, "Launch graphics");
  assert.equal(view.revision, 1);
  assert.equal(view.budgetUsdCents, null);
  assert.equal(view.freshness, "fresh");
  const list: OpportunityView[] = [
    view,
    { ...view, entityKey: `0x${"cd".repeat(32)}` as OpportunityView["entityKey"], title: "Explainer design", summary: "visual guide" },
  ];
  assert.equal(filterOpportunities(list, { query: "graphics" }).length, 1);
  assert.equal(filterOpportunities(list, { query: "nope-nothing" }).length, 0);
  assert.equal(filterOpportunities(list, {}).length, 2);
});

test("briefStateToScene parks the worker at the Planning Desk when idle", async () => {
  const home = BUILDING_BY_ID.home.waypoint;
  const idle = briefStateToScene(null);
  assert.equal(idle.building, "home", "no active brief parks at the Planning Desk");
  assert.deepEqual({ x: idle.x, y: idle.y }, home);
  assert.deepEqual(
    { x: briefStateToScene(brief({ executionStatus: "draft" })).x, y: briefStateToScene(brief({ executionStatus: "draft" })).y },
    home,
  );
  assert.equal(briefStateToScene(brief({ executionStatus: "running" })).building, "studio");
  assert.equal(briefStateToScene(brief({ executionStatus: "ready" })).building, "treasury");
  const cand = candidate({ status: "open" });
  const payload = projectPublicOpportunity(cand, 1);
  const h = await hashPublicOpportunity(payload);
  const approvedLive = brief({
    executionStatus: "ready",
    editedDraft: cand,
    review: {
      status: "approved",
      approval: { draftRevision: 1, publicPayloadHash: h, canonicalPublicPayload: payload, approvedBy: OWNER, approvedAt: NOW() },
    },
    publication: {
      status: "live",
      freshness: "fresh",
      confirmed: {
        entityKey: `0x${"bb".repeat(32)}`,
        ownerAddress: OWNER,
        publicRevision: 1,
        observedPayloadHash: h,
        lastConfirmedTransaction: `0x${"cc".repeat(32)}`,
        expiresAtBlock: "123",
        observedAt: NOW(),
        observedAtBlock: "120",
        status: "live",
        externalChange: false,
      },
      pending: null,
    },
  });
  assert.equal(briefStateToScene(approvedLive).building, "registry");
  assert.equal(briefStateToScene(brief({ executionStatus: "failed", error: { code: "PROVIDER_FAILED", message: "x", retryable: true } })).unresolved, true);
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

type ExecutionStatus = BriefView["executionStatus"];
type PublicationStatus = BriefView["publication"]["status"];
type ReviewStatus = BriefView["review"]["status"];
type BriefFreshness = BriefView["publication"]["freshness"];

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

test("city mapping: adapter from BriefView", async () => {
  assert.deepEqual(cityInputFromBrief(null), NO_BRIEF_INPUT);
  const cand = candidate({ status: "open" });
  const payload = projectPublicOpportunity(cand, 1);
  const live = brief({
    editedDraft: cand,
    draftRevision: 2,
    review: {
      status: "approved",
      approval: {
        draftRevision: 1,
        publicPayloadHash: await hashPublicOpportunity(payload),
        canonicalPublicPayload: payload,
        approvedBy: OWNER,
        approvedAt: new Date().toISOString(),
      },
    },
  });
  // Edit after approval (revision 2 vs approved 1): approval is not current.
  assert.equal(cityInputFromBrief(live).approvalCurrent, false);
  assert.equal(deriveCityState(cityInputFromBrief(live)).release, "awaiting");
  // A pending intent without confirmed entity is not live.
  const pendingOnly = brief({
    publication: {
      status: "pending",
      freshness: "fresh",
      confirmed: null,
      pending: {
        intent: {
          intentId: ID,
          operation: "create",
          chainId: 7794095,
          ownerAddress: OWNER,
          entityKey: null,
          basePayloadHash: null,
          payload,
          publicPayloadHash: await hashPublicOpportunity(payload),
          expiresAtBlock: "999",
          createdAt: new Date().toISOString(),
        },
        transactionHash: null,
        state: "unknown",
      },
    },
  });
  assert.equal(deriveCityState(cityInputFromBrief(pendingOnly)).registry, "pending");
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

// --- Isometric game layout (pure) ---
import {
  doorFor,
  isRoadCell,
  isoRoute,
  KEY_PLOTS,
  ROAD_CENTRES,
  GRID_N,
  SAND_RING,
  toWorld,
} from "../../src/components/city/iso-layout";

const IDS = ["home", "studio", "treasury", "registry", "archive"] as const;

test("iso layout: plots sit on land, off roads and apart", () => {
  for (const id of IDS) {
    const p = KEY_PLOTS[id];
    for (let x = p.gx; x < p.gx + p.size; x++)
      for (let y = p.gy; y < p.gy + p.size; y++) {
        assert.equal(isRoadCell(x, y), false, `${id} overlaps road at ${x},${y}`);
        assert.ok(x >= SAND_RING && y >= SAND_RING && x < GRID_N - SAND_RING && y < GRID_N - SAND_RING);
      }
    const d = doorFor(id);
    assert.ok(isRoadCell(Math.floor(d.gx), Math.floor(d.gy)), `${id} door is on a road`);
  }
  assert.deepEqual(toWorld({ gx: 1, gy: 0 }), { x: 20, y: 10 });
});

test("iso layout: routes between every pair stay on road centrelines", () => {
  const onCentre = (v: number) => ROAD_CENTRES.some((c) => Math.abs(c - v) < 1e-9);
  for (const a of IDS)
    for (const b of IDS) {
      const r = isoRoute(doorFor(a), doorFor(b));
      assert.deepEqual(r[0], doorFor(a));
      assert.deepEqual(r[r.length - 1], doorFor(b));
      assert.ok(r.length <= 4, `${a}->${b} turns at most twice`);
      for (let k = 1; k < r.length; k++) {
        const p = r[k - 1];
        const q = r[k];
        const alongCol = p.gx === q.gx && onCentre(p.gx);
        const alongRow = p.gy === q.gy && onCentre(p.gy);
        assert.ok(alongCol || alongRow, `${a}->${b} segment ${k} follows a road`);
      }
      assert.deepEqual(isoRoute(doorFor(a), doorFor(b)), r);
    }
  // Re-targeting from a point mid-way along a row road.
  const mid = { gx: 9, gy: ROAD_CENTRES[1] };
  const r = isoRoute(mid, doorFor("archive"));
  assert.equal(r[1].gy, ROAD_CENTRES[1]);
  assert.throws(() => isoRoute({ gx: 7.2, gy: 7.3 }, doorFor("home")));
});
