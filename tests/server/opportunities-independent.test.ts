import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectPublicOpportunity, type OpportunityRecord } from "../../src/lib/shared/briefs";

const list = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/arkiv/briefmint/read", () => ({
  createArkivBriefmintReader: () => ({ list }),
}));

import { readOpportunitiesIndependent } from "../../src/lib/arkiv/opportunities-independent";

// Synthetic public records and an isolated adapter double; no RPC or wallet.
const record: OpportunityRecord = {
  entityKey: `0x${"a".repeat(64)}`,
  ownerAddress: `0x${"1".repeat(40)}`,
  expiresAtBlock: "2000",
  observedAtBlock: "1000",
  observedAt: "2026-11-06T00:00:00.000Z",
  payload: projectPublicOpportunity({
    parameters: { title: "Synthetic brief", summary: "Public summary", category: "writing", language: "en", budgetUsdCents: null, deadline: "2026-11-07T00:00:00.000Z", contactUrl: null },
    sections: { deliverables: ["One explainer"], acceptanceCriteria: ["Readable text"], exclusions: ["No code"], openQuestions: ["Who reviews?"] },
    status: "open",
  }, 1),
};

describe("browser independent discovery — offline adapter double", () => {
  beforeEach(() => { list.mockReset(); });

  it("continues empty pages, deduplicates overlap and preserves full public brief sections", async () => {
    list.mockResolvedValueOnce({ records: [], nextCursor: "50" })
      .mockResolvedValueOnce({ records: [record], nextCursor: "100" })
      .mockResolvedValueOnce({ records: [record], nextCursor: null });
    const rows = await readOpportunitiesIndependent({ accessKey: "" }, { status: "open" });
    expect(list).toHaveBeenCalledTimes(3);
    expect(list.mock.calls.map(([input]) => input.cursor)).toEqual([undefined, "50", "100"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      summary: record.payload.summary,
      deliverables: record.payload.deliverables,
      acceptanceCriteria: record.payload.acceptanceCriteria,
      exclusions: record.payload.exclusions,
      openQuestions: record.payload.openQuestions,
    });
  });

  it("rejects nonadvancing cursors instead of looping or presenting a partial catalogue", async () => {
    list.mockResolvedValueOnce({ records: [record], nextCursor: "50" })
      .mockResolvedValueOnce({ records: [], nextCursor: "50" });
    await expect(readOpportunitiesIndependent({ accessKey: "" }, { status: "open" })).rejects.toThrow(/pagination/);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("bounds a never-ending catalogue and reports failure instead of silent truncation", async () => {
    list.mockImplementation(async ({ cursor }: { cursor?: string }) => ({ records: [], nextCursor: String(Number(cursor ?? 0) + 50) }));
    await expect(readOpportunitiesIndependent({ accessKey: "" }, { status: "open" })).rejects.toThrow(/pagination/);
    expect(list).toHaveBeenCalledTimes(20);
  });
});
