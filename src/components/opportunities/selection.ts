import type { OpportunityView } from "@/lib/shared/briefmint";

export function resolveOpportunitySelection(
  rows: readonly OpportunityView[],
  picked: OpportunityView | null,
  dismissed: boolean,
): OpportunityView | null {
  if (dismissed) return null;
  if (picked && rows.some((row) => row.entityKey === picked.entityKey)) return picked;
  return rows[0] ?? null;
}
