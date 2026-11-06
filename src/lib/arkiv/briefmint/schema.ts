import { defineSchema, bool, bytes, str, u64 } from "@arkiv-network/sdk/schema";
import { canonicalPublicJson, OPPORTUNITY_NAMESPACE, publicOpportunitySchema, type PublicOpportunity } from "../../shared/briefs";

/** Named Arkiv schema with indexed fields that support public opportunity discovery. */
export const BriefmintOpportunitySchema = defineSchema(OPPORTUNITY_NAMESPACE, {
  app: str().indexed(), schemaVersion: u64().indexed(), category: str().indexed(), language: str().indexed(),
  status: str().indexed(), budgetPresent: bool().indexed(), budgetUsdCents: u64().indexed(), deadlineUnixSeconds: u64().indexed(),
  title: str(), content: bytes(),
});

export function briefmintOpportunityValues(payload: PublicOpportunity) {
  const parsed = publicOpportunitySchema.parse(payload);
  return {
    app: str(OPPORTUNITY_NAMESPACE),
    schemaVersion: u64(1),
    category: str(parsed.category),
    language: str(parsed.language),
    status: str(parsed.status),
    budgetPresent: bool(parsed.budgetUsdCents !== null),
    budgetUsdCents: u64(parsed.budgetUsdCents ?? 0),
    deadlineUnixSeconds: u64(Math.floor(Date.parse(parsed.deadline) / 1000)),
    title: str(parsed.title),
    content: bytes(new TextEncoder().encode(canonicalPublicJson(parsed))),
  };
}
