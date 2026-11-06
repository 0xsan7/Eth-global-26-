import { describe, expect, it, vi } from "vitest";
import { runArkivReader } from "../../scripts/lib/briefmint-arkiv-reader";
import { projectPublicOpportunity, type OpportunityRecord } from "../../src/lib/shared/briefs";

// Deterministic public records and read adapters only; no network or wallet operations.
const id = `0x${"a".repeat(64)}`;
const record: OpportunityRecord = { entityKey: id, ownerAddress: `0x${"1".repeat(40)}`, expiresAtBlock: "1000", observedAtBlock: "10", observedAt: "2026-11-06T00:00:00.000Z",
  payload: projectPublicOpportunity({ parameters: { title: "Synthetic public task", summary: "A test double", category: "writing", language: "en", budgetUsdCents: 0,
    deadline: "2026-11-07T00:00:00.000Z", contactUrl: null }, sections: { deliverables: ["Text"], acceptanceCriteria: ["Readable"], exclusions: [], openQuestions: [] }, status: "open" }, 1) };
function setup() {
  const lines: string[] = [], errors: string[] = [];
  const reader = { get: vi.fn(async () => record as OpportunityRecord | null), list: vi.fn(async () => ({ records: [record], nextCursor: null as string | null })), currentBlock: vi.fn(async () => ({ number: "1001" })) };
  const factory = vi.fn(() => reader);
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", ARKIV_ACCESS_KEY: "synthetic-endpoint-access-never-print" };
  for (const name of ["ZERO_G_API_KEY", "SESSION_SECRET", "DATABASE_PATH"]) Object.defineProperty(env, name, { get() { throw new Error("Must not inspect private runtime"); } });
  return { lines, errors, reader, factory, env, run: (args: string[], environment = env) => runArkivReader(args, environment, { log: value => lines.push(value), error: value => errors.push(value) }, factory, () => "2026-11-06T00:00:00.000Z", () => 10) };
}
describe("independent Arkiv reader CLI — offline doubles", () => {
  it("does nothing remotely by default and rejects invalid/ambiguous queries before client creation", async () => {
    const test = setup(); expect(await test.run([])).toBe(0); expect(test.factory).not.toHaveBeenCalled();
    for (const args of [["--list", "--get", id], ["--list", "--limit", "0"], ["--get", "bad"], ["--list", "--cursor", "1e2"], ["--list", "--paid"], ["--list", "--list"]]) expect(await test.run(args)).toBe(2);
    expect(await test.run(["--list"], { NODE_ENV: "test" })).toBe(2); expect(test.factory).not.toHaveBeenCalled();
  });
  it("reads public fields with indexed filter inputs while never inspecting private configuration", async () => {
    const test = setup(); expect(await test.run(["--list", "--category", "writing", "--min-budget-usd-cents", "0", "--limit", "1"])).toBe(0);
    expect(test.reader.list).toHaveBeenCalledWith({ category: "writing", language: "en", status: "open", minBudgetUsdCents: 0, deadlineAfter: record.observedAt, limit: 1 });
    expect(JSON.parse(test.lines[0])).toMatchObject({ status: "found", audience: "public", records: [record] });
    expect(test.lines.join()).not.toMatch(/synthetic-endpoint-access|Cookie|Authorization/);
  });
  it("allows explicit public endpoint mode and retrieves an entity without a key/session/API", async () => {
    const test = setup(); const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
    Object.defineProperty(env, "ARKIV_ACCESS_KEY", { get() { throw new Error("Must not read key"); } });
    expect(await test.run(["--get", id, "--public-endpoint"], env)).toBe(0);
    expect(test.factory).toHaveBeenCalledWith({ accessKey: "" }); expect(test.reader.get).toHaveBeenCalledWith(id);
    expect(JSON.parse(test.lines[0])).toMatchObject({ status: "found", record });
  });
  it("distinguishes empty/absent reads from sanitized network errors", async () => {
    const test = setup(); test.reader.list.mockResolvedValueOnce({ records: [], nextCursor: "2" });
    expect(await test.run(["--list"])).toBe(0); expect(JSON.parse(test.lines[0])).toMatchObject({ status: "empty", nextCursor: "2" });
    test.reader.get.mockResolvedValueOnce(null); expect(await test.run(["--get", id])).toBe(0); expect(JSON.parse(test.lines[1])).toMatchObject({ status: "absent", blockObservedAfterAbsence: "1001" });
    test.reader.list.mockRejectedValueOnce(new Error("PRIVATE URL and access credential"));
    expect(await test.run(["--list"])).toBe(1); expect(JSON.parse(test.errors[0])).toEqual({ status: "failed", phase: "read", code: "ARKIV_READ_FAILED" });
    expect(test.errors.join()).not.toMatch(/PRIVATE|credential/);
    test.reader.get.mockResolvedValueOnce({ ...record, notes: "PRIVATE_CANARY" } as OpportunityRecord);
    expect(await test.run(["--get", id])).toBe(1); expect(test.errors.join()).not.toContain("PRIVATE_CANARY");
  });
});
