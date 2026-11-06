# BriefMint integration contract — PROPOSED frozen v0.1-briefmint-proposed

**Status:** proposed by Agent B (frontend/Arkiv) from BriefMint-PRD.md §§9–11.
**Not yet confirmed by San/backend.** Do not treat as frozen until San signs.
Frontend implements against this file; backend must implement the same shapes
or request a joint revision (bump version, notify both sides).

**Scope rule:** legacy translation/payment DTOs in `src/lib/shared/domain.ts`
and `src/lib/shared/api.ts` are preserved untouched. BriefMint adds
`src/lib/shared/briefmint*.ts` — never widens translation types.

## Shared DTOs (`src/lib/shared/briefmint.ts`)

- `BRIEFMINT_NAMESPACE = "tool-city.opportunity.v1"`, `SCHEMA_VERSION = 1`.
- `PrivateBrief`, `BriefSummary`, `PublicParameters`, `ModelBriefResult`,
  `BriefApproval`, `BriefPublicationState`, `BriefInferenceEvidence`,
  `PublicPayload` (exact allowlist), `OpportunityView`, `OpportunityFilters`,
  `BriefMintConfig`.
- Canonicalization: sorted-keys JSON → `keccak256(utf8)` hash. Approval binds
  `(draftRevision, publicPayloadHash)`; any public-content edit invalidates it.

## Validation (`briefmint-validation.ts`)

- Notes: 250 words / 5,000 chars / 20 paragraphs (PRD §9 bounds retained).
- Title ≤ 100 UTF-8 bytes (chain `str` limit is 128); summary ≤ 280 chars;
  budget integer cents or absent; contact https-only; deadline future ≤ 7 days.
- `projectPublicPayload()` builds the allowlist from the saved draft only.
- `assertPublicPayloadClean()` rejects private keys; tested in
  `tests/ui/briefmint.test.ts`.

## API routes (proposed, PRD §11) — `briefmint-api.ts` / `use-briefs.ts`

| Method / path | Purpose | Auth |
|---|---|---|
| `GET /api/briefmint/config` | Readiness, limits, network info | Public |
| `GET /api/briefs` | Owner's private summaries | Session |
| `POST /api/briefs` | Validate/save notes + params | Session, server owner |
| `GET /api/briefs/:id` | Private detail + recovery | Owner only |
| `POST /api/briefs/:id/run` | Quota/lease claim + compile (202 while running) | Owner, quota policy |
| `PUT /api/briefs/:id/draft` | Save edited candidate, expected revision | Owner, optimistic concurrency |
| `POST /api/briefs/:id/approve` | Approve exact revision + hash | Owner, recompute server-side |
| `POST /api/briefs/:id/publication/prepare` | Approved public data for the browser adapter | Owner, current approval |
| `POST /api/briefs/:id/publication/reconcile` | Check tx/entity vs approved data (202 pending) | Owner, server chain read |
| `GET /api/briefs/:id/export` | Saved private TXT/JSON | Owner |
| `GET /api/opportunities` | Optional server query convenience | Public (independent reader is primary) |

Envelope: `{ ok: true, data }` / `{ ok: false, error: { code, message, retryable } }`.
Statuses: 202 in-progress, 401 no session, 404 missing/wrong-owner, 409
revision/state conflict, 429 quota exhausted, 503 dependency unavailable.
Poll only `running` / `pending-publication` (~2s); never auto-dispatch on mount.

**Current backend reality:** these routes are NOT implemented — the deployed
backend still serves only legacy `/api/jobs/*` (translation). The frontend
therefore renders `unavailable (503)` for BriefMint mutations and falls back
to the independent Arkiv reader for discovery. No fixture is ever presented
as live data.

## Arkiv opportunity schema (`opportunity-schema.ts`)

Namespace `tool-city.opportunity.v1`, 12 attributes (limit 32):

| Column | Type | Indexed | Notes |
|---|---|---|---|
| `app` | str | yes | Always the namespace; defense-in-depth |
| `category` | str | yes | `writing` / `design` filter |
| `language` | str | yes | Always `en` |
| `status` | str | yes | `open` / `closed` lifecycle |
| `budgetPresent` | bool | yes | Budget filter |
| `budgetCents` | u64 | yes | 0 when absent |
| `deadline` | str | yes | ISO business timestamp |
| `title` | str | no | ≤ 128 bytes |
| `summary` | bytes | no | Longer UTF-8 text |
| `details` | bytes | no | JSON sections, ≤ 8 KiB |
| `contact` | str | no | https URL or empty |
| `revision` | u64 | yes | Public revision |

Indexed filters (`category`, `language`, `status`, `budgetPresent`) execute
server-side via `eq`/`and` in `opportunities-read.ts`; text search filters
client-side after fetch. Owner/expiry are system fields (`$owner`,
`$expiresAt`). Writes (`opportunities-write.ts`) are browser wallet-signed
only; the owner wallet is the connected project-owner wallet — its private
key is never requested. A submitted tx is NOT success: the backend
`/reconcile` read must confirm owner/payload/revision/expiry first.

## State model (PRD §10)

Execution `draft → running → ready | failed | interrupted`; review
`unreviewed | approved` (edit invalidates); publication `unpublished |
pending → live | closed | expired`; observation `fresh | stale |
unavailable`. RPC failure ≠ deletion/closure/expiry.

## Open decisions for San

1. Confirm/adjust DTO field names, endpoint paths, and quota policy.
2. Auth-chain policy for the new mode (legacy challenge hardcodes 1874).
3. Model selection, token budget, global dispatch limit, timeout values.
4. `GET /api/opportunities` convenience vs reader-only discovery.
5. Migration numbering for `briefs`, `brief_attempts`, `brief_approvals`,
   `brief_publications`, quota ledger tables.
