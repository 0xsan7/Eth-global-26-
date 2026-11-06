// DEV-ONLY scene previews. Enabled only in development with ?cityFixture in the URL.
// Fixture states are labelled as fixtures and never presented as real data.
import { NO_BRIEF_INPUT, type CityStateInput } from "./city-state";

const ready: CityStateInput = { ...NO_BRIEF_INPUT, briefId: "fixture-preview", execution: "ready" };
const approved: CityStateInput = { ...ready, review: "approved", approvalCurrent: true };
const confirmed = { publicationConfirmed: true, observedAt: "fixture" };

export const CITY_FIXTURES: Array<{ id: string; label: string; input: CityStateInput }> = [
  { id: "draft", label: "draft", input: { ...ready, execution: "draft" } },
  { id: "running", label: "running", input: { ...ready, execution: "running" } },
  { id: "ready", label: "ready", input: ready },
  { id: "approved", label: "approved", input: approved },
  { id: "pending", label: "publication pending", input: { ...approved, publication: "pending" } },
  { id: "live", label: "live", input: { ...approved, publication: "live", ...confirmed } },
  { id: "closed", label: "closed", input: { ...approved, publication: "closed", ...confirmed } },
  { id: "expired", label: "expired", input: { ...approved, publication: "expired", ...confirmed } },
  { id: "stale", label: "stale", input: { ...approved, publication: "live", ...confirmed, freshness: "stale" } },
  {
    id: "unavailable",
    label: "unavailable",
    input: { ...approved, publication: "live", ...confirmed, freshness: "unavailable" },
  },
  { id: "failed", label: "failed", input: { ...ready, execution: "failed" } },
  { id: "interrupted", label: "interrupted", input: { ...ready, execution: "interrupted" } },
];
