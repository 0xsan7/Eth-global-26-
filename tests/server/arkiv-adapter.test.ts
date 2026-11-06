import { describe, expect, it } from "vitest";
import { recordFromArkivRow } from "../../src/lib/arkiv/briefmint/read";
import { briefmintOpportunityValues } from "../../src/lib/arkiv/briefmint/schema";
import { projectPublicOpportunity, type BriefCandidate } from "../../src/lib/shared/briefs";

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
});
