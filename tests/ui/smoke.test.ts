// Tool City — Agent B UI smoke checks (focused, dependency-free).
//
// Run typecheck (project root):  npx tsc --noEmit
// Run tests: this repo's sources use extensionless (bundler-style) imports plus
// the `@/*` alias, which raw Node ESM cannot resolve, so compile to temp JS
// first and then use node --test (no new project deps; TypeScript and
// @types/node live outside the project, in $env:TEMP\toolcity-smoke, which
// provides tsconfig.smoke.json, types-dl/ and node_modules/typescript):
//   node "$env:TEMP\toolcity-smoke\node_modules\typescript\bin\tsc" `
//     -p "$env:TEMP\toolcity-smoke\tsconfig.smoke.json"
//   node --test "$env:TEMP\toolcity-smoke\build\tests\ui\smoke.test.js"
//
// What is real vs reference in this file (honest labelling):
// - `validation.*` / `fixtures.*` are the REAL Agent A shared modules.
// - `jobStateToScene` / `PLAZA` are the REAL Agent B city modules.
// - `exportedResultText` is a CONTRACT-REFERENCE mirror of the exported pure
//   `resultText()` in src/components/jobs/TranslationReview.tsx, which cannot be
//   imported here without dragging React + the wallet/api graph into a plain
//   node --test run. It replicates that function's fallback chain exactly
//   (saved edited ?? saved model, blank-line join, "" when nothing saved) so a
//   drift in the component breaks this test's documented expectation.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CHARS,
  MAX_SEGMENTS,
  MAX_WORDS,
  countWords,
  isAddress,
  isBytes32,
  isHexString,
  sameAddress,
  segmentIds,
  splitSegments,
  validateJobText,
} from "../../src/lib/shared/validation";
import {
  DEV_FIXTURE_JOB,
  DEV_FIXTURE_WORKSHOP,
} from "../../src/lib/shared/fixtures";
import { jobStateToScene } from "../../src/components/city/job-state-to-scene";
import { PLAZA } from "../../src/components/city/scene-config";
import type { JobStatus, JobView } from "../../src/lib/shared/domain";

const OFFICIAL_WHITECHAIN_TOKEN =
  "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";

const makeWords = (n: number): string =>
  Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

// --- §7 text validation: word cap ---

test("word cap: 250 words pass, 251 words fail with BAD_INPUT", () => {
  assert.equal(MAX_WORDS, 250);
  assert.deepEqual(validateJobText(makeWords(250)), { ok: true });
  const over = validateJobText(makeWords(251));
  assert.equal(over.ok, false);
  assert.equal((over as { code: string }).code, "BAD_INPUT");
});

test("no hard 100-word minimum: short drafts are accepted", () => {
  assert.deepEqual(validateJobText("Hello world"), { ok: true });
  assert.equal(countWords("  hello   world\n"), 2);
});

test("empty or whitespace-only text is rejected", () => {
  for (const t of ["", "   ", "\n\n  \n"]) {
    const r = validateJobText(t);
    assert.equal(r.ok, false);
    assert.equal((r as { code: string }).code, "BAD_INPUT");
  }
});

// --- §7 text validation: char cap ---

test("char cap: 5000 chars pass, 5001 chars fail", () => {
  assert.equal(MAX_CHARS, 5000);
  assert.deepEqual(validateJobText("a".repeat(5000)), { ok: true });
  const over = validateJobText("a".repeat(5001));
  assert.equal(over.ok, false);
  assert.equal((over as { code: string }).code, "BAD_INPUT");
});

// --- §7 segmentation: blank-paragraph split, stable IDs, 20-segment cap ---

test("splitSegments splits on blank paragraphs, trims, drops empties", () => {
  assert.deepEqual(splitSegments("alpha\n\n\nbeta\n\n   \n\ngamma"), [
    "alpha",
    "beta",
    "gamma",
  ]);
  assert.deepEqual(splitSegments("single paragraph"), ["single paragraph"]);
  assert.deepEqual(splitSegments("  \n\n "), []);
});

test("splitSegments caps at 20 nonempty segments", () => {
  assert.equal(MAX_SEGMENTS, 20);
  const paras = Array.from({ length: 22 }, (_, i) => `para ${i + 1}`).join(
    "\n\n",
  );
  const segs = splitSegments(paras);
  assert.equal(segs.length, 20);
  assert.equal(segs[0], "para 1");
  assert.equal(segs[19], "para 20");
});

test("segmentIds are stable seg_NNN identifiers (not EVM ids)", () => {
  assert.deepEqual(segmentIds(3), ["seg_001", "seg_002", "seg_003"]);
  assert.equal(segmentIds(20)[19], "seg_020");
  assert.equal(isBytes32("seg_001"), false);
});

// --- §5 address handling: validate, never literal-compare mixed case ---

test("address/bytes32 guards accept official token, reject junk", () => {
  assert.equal(isAddress(OFFICIAL_WHITECHAIN_TOKEN), true);
  assert.equal(isAddress("0x123"), false);
  assert.equal(isAddress("not-an-address"), false);
  assert.equal(isHexString("0xzz"), false);
  assert.equal(isBytes32(`0x${"ab".repeat(32)}`), true);
  assert.equal(isBytes32(OFFICIAL_WHITECHAIN_TOKEN), false); // 20 bytes, not 32
});

test("sameAddress compares case-insensitively", () => {
  assert.equal(
    sameAddress(
      OFFICIAL_WHITECHAIN_TOKEN,
      OFFICIAL_WHITECHAIN_TOKEN.toLowerCase(),
    ),
    true,
  );
  assert.equal(
    sameAddress(
      OFFICIAL_WHITECHAIN_TOKEN,
      OFFICIAL_WHITECHAIN_TOKEN.toUpperCase(),
    ),
    true,
  );
  assert.equal(
    sameAddress(
      OFFICIAL_WHITECHAIN_TOKEN,
      "0x0000000000000000000000000000000000000000",
    ),
    false,
  );
});

// --- fixtures: labelled dev-only, never live evidence ---

test("dev fixtures are explicitly labelled and unsupported", () => {
  assert.equal(DEV_FIXTURE_WORKSHOP.supported, false);
  assert.equal(DEV_FIXTURE_WORKSHOP.freshness, "stale");
  assert.match(DEV_FIXTURE_WORKSHOP.title, /fixture/i);
  assert.equal(DEV_FIXTURE_JOB.status, "awaiting_payment");
  assert.equal(
    sameAddress(
      DEV_FIXTURE_JOB.terms.tokenAddress,
      OFFICIAL_WHITECHAIN_TOKEN,
    ),
    true,
  );
});

// --- real city mapper: jobStateToScene (spec §7/§8) ---

const jobWithStatus = (status: JobStatus): JobView => ({
  ...DEV_FIXTURE_JOB,
  status,
});

test("jobStateToScene drives worker building and flags from job status", () => {
  const cases: Array<{
    status: JobStatus;
    building: string | null;
    parcel: boolean;
    unresolved: boolean;
  }> = [
    { status: "awaiting_payment", building: "treasury", parcel: false, unresolved: false },
    { status: "payment_pending", building: "treasury", parcel: false, unresolved: false },
    { status: "paid", building: "studio", parcel: false, unresolved: false },
    { status: "running", building: "studio", parcel: false, unresolved: false },
    { status: "ready", building: "home", parcel: true, unresolved: false },
    { status: "interrupted", building: "studio", parcel: false, unresolved: true },
    { status: "failed", building: "studio", parcel: false, unresolved: true },
  ];
  for (const c of cases) {
    const scene = jobStateToScene(jobWithStatus(c.status));
    assert.equal(scene.building, c.building, `building for ${c.status}`);
    assert.equal(scene.parcel, c.parcel, `parcel for ${c.status}`);
    assert.equal(scene.unresolved, c.unresolved, `unresolved for ${c.status}`);
  }
});

test("jobStateToScene idles a null job at the plaza", () => {
  const scene = jobStateToScene(null);
  assert.equal(scene.building, null);
  assert.deepEqual({ x: scene.x, y: scene.y }, PLAZA);
});

// --- export source rule (mirrors resultText in TranslationReview.tsx) ---
// Rule: export saved edited segments when present, else saved model output;
// TXT joins with blank lines; nothing saved => empty (component shows
// "Nothing saved to export yet."). Edited text is never labelled model output.

function exportedResultText(job: JobView): string {
  const segs = job.editedSegments ?? job.modelSegments;
  return segs ? segs.map((s) => s.text).join("\n\n") : "";
}

test("export text uses saved edited over model, model over nothing", () => {
  const model = [
    { id: "seg_001", text: "model one" },
    { id: "seg_002", text: "model two" },
  ];
  const edited = [{ id: "seg_001", text: "edited one" }];
  // Fixture job has nothing saved yet: no exportable text.
  assert.equal(exportedResultText(DEV_FIXTURE_JOB), "");
  assert.equal(
    exportedResultText({ ...DEV_FIXTURE_JOB, modelSegments: model }),
    "model one\n\nmodel two",
  );
  assert.equal(
    exportedResultText({
      ...DEV_FIXTURE_JOB,
      modelSegments: model,
      editedSegments: edited,
    }),
    "edited one",
  );
});
