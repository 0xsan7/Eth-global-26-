# BriefMint Agent B handoff (current implementation)

This is a frontend integration handoff; the browser journey has not been exercised. The current React city calls the shared contract in `src/lib/shared/briefs.ts`; keep those DTOs authoritative. Root Next is the API on port 4100 and `apps/web` is the Vite browser on 5173. Agent B may edit `apps/web/src/{App,Root}.tsx`, `apps/web/src/lib/briefmint-api.ts`, city/HUD components, Vite config/package files as needed, and the browser adapter `src/lib/arkiv/briefmint/write.ts`. Coordinate root dependency changes with A. Backend `schema.ts`/`read.ts`, server/API, shared DTOs and migrations remain A-owned for this phase.

## Local start and origin

From the repository root, use Node 24. Configure an ignored local environment file with a random `SESSION_SECRET` (at least 32 characters), `APP_ORIGIN=http://127.0.0.1:5173`, `DATABASE_PATH` under a private temporary directory, and explicit quota policy values. Empty `BRIEFMINT_ALLOWED_WALLETS` makes compilation unavailable; use a wallet address only if that operator is explicitly allowlisting it. Keep live keys out of the browser build and shell history. Start the API with `npm run dev -- --hostname 127.0.0.1 --port 4100`; in another terminal run `cd apps/web && npm run dev -- --host 127.0.0.1 --port 5173`. Open exactly `http://127.0.0.1:5173`. The Vite `/api` proxy forwards to port 4100 and preserves browser Origin. Do not mix `localhost` and `127.0.0.1`, or call port 4100 directly from the browser. Existing auth cookie is HttpOnly `tool_city_session`, Path `/`, SameSite=Lax; use same-origin relative fetches with `credentials: "same-origin"`. Production should use one HTTPS origin and preserve original Origin and Cookie/Set-Cookie through the reverse proxy.

Sign-in is `GET /api/auth/challenge?address=<wallet>&purpose=briefmint`, then `POST /api/auth/verify` with `{challengeId,signature}`. The challenge is server-selected for chain 7794095 and expressly is not publication authorization. Auth endpoints use the existing auth response contract. Account or network changes currently clear the view and log out; a session authenticates an owner, while every write still needs an account and chain check.

## Brief API contract

All JSON responses use `{ok:true,data}` or `{ok:false,error:{code,message,retryable}}`, with `Cache-Control: no-store`. `Content-Type: application/json`; bodies are strict, max 32,000 bytes, reject unknown keys and duplicate query keys. Nullable response fields are explicit `null`. Dates are UTC ISO milliseconds with `Z`; IDs/hashes are lowercase `0x` + 64 hex; block numbers are unsigned decimal strings; money is integer USD cents. Do not invent owner/model/quota/evidence fields. The current registry is `briefApi` in shared `briefs.ts`.

| Method and path | Request | Success |
|---|---|---|
| `GET /api/briefmint/config` | no query | `data: BriefmintConfig`, 200 |
| `GET /api/briefs` | optional `?beforeId=<id>` | `data: {briefs: BriefSummary[], nextBeforeId: id | null}`, 200, max 50 |
| `POST /api/briefs` | `{notes,publicParameters}` | `data: BriefView`, 201 |
| `GET /api/briefs/:id` | no query | `data: BriefView`, 200 |
| `POST /api/briefs/:id/run` | `{}` | `data: BriefView`, 200 ready or 202 running |
| `PUT /api/briefs/:id/draft` | `{expectedRevision,draft}` | `data: BriefView`, 200 |
| `POST /api/briefs/:id/approve` | `{expectedRevision,publicPayloadHash}` | `data: BriefView`, 200 |
| `POST /api/briefs/:id/publication/prepare` | `{intentId,expectedRevision,publicPayloadHash,operation}` (`create | update | close`) | `data: PublicationIntent`, 200 |
| `POST /api/briefs/:id/publication/reconcile` | `{intentId,transactionHash,entityKey}` (last two nullable) | `data: BriefView`, 200 settled or 202 unresolved |
| `POST /api/briefs/:id/publication/refresh` | `{}` | `data: BriefView`, 200 |
| `GET /api/briefs/:id/export` | required `?format=txt|json`, optional `&audience=private|public` | `data: {filename,mediaType,content}`, 200 |

Errors: 400 `BAD_INPUT`; 401 `UNAUTHENTICATED`; 403 `FORBIDDEN` origin; 404 `NOT_FOUND` (absent and wrong-owner private IDs alike); 409 `REVISION_CONFLICT`, `BRIEF_NOT_READY`, `APPROVAL_REQUIRED`, `PAYLOAD_MISMATCH`, `PUBLICATION_CONFLICT`, `RETRY_NOT_ALLOWED`; 429 `QUOTA_EXHAUSTED`; 502 `PROVIDER_FAILED`; 503 `SERVICE_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `ARKIV_UNAVAILABLE`; 500 sanitized `INTERNAL_ERROR`. Render failures, never interpret a read failure as an empty list. `refresh` is a server chain read, not a write or inference. `export` is owner-authenticated; default audience is private, and public export is only the current approved projection. Public TXT/JSON is not proof of publication.

## Data boundaries and state handling

Keep `BriefView` private: source notes/segments, model output, evidence, private owner/address association, draft edits and review data stay behind owner-authenticated API reads and private export. The public record is the explicit `PublicOpportunity` projection (schema v1, `tool-city.opportunity.v1`): approved title, summary, category/language, optional budget (always unfunded), deadline/contact, deliverables/acceptance/exclusions/questions and `open|closed` status. Public ownership comes from Arkiv's system fields. Never put source IDs, private IDs, source notes/hash, prompts, or evidence into Arkiv content. Show the exact public preview before approval/signing; public text must still be inspected for sensitive facts.

Roles: server `prepare` validates current owner approval, exact canonical payload hash, deadline, chain readiness and operation/base state, then durably records the immutable intent before a wallet is asked. The browser recomputes/validates the intent hash, checks connected account equals intent owner and chain is 7794095, then displays exact payload and invokes SDK write with the wallet; never send `BriefView` to a write helper or use a server owner key. Persist intent ID and any transaction/entity identifiers in browser storage before reporting dispatch success. Server `reconcile` independently checks receipt, signer, entity owner, namespace, canonical payload/hash/revision, indexed attributes and actual expiry; hints are untrusted. Refresh obtains a new observation only. Avoid claiming atomic compare-and-swap or exactly-once writes.

Current state rule from A: pending intent has state `prepared|unknown|submitted|reverted`; legacy pending data defaults to `unknown`. Only a freshly revalidated `prepared` intent may start a signing attempt: call server `prepare` again with the same intent ID and unchanged operation/revision/hash and use the newly returned intent. Before invoking the wallet, durably record that attempt and call `reconcile` with null transaction/entity hints to arm the backend's uncertainty lock. That call returns 202/`unknown`; only this one in-memory attempt may proceed with the captured validated intent. A reload must never interpret `unknown` as permission to sign. Record any returned hash promptly using `reconcile`. Null hints are allowed to lock uncertain submission, not evidence that a transaction was cancelled. A wallet rejection before arming can revalidate the same prepared intent; rejection after arming remains conservatively locked. There is no cancellation endpoint or safe replacement create while existence/broadcast is uncertain. A reverted receipt is separately labelled `reverted`, but does not prove that this exact intent was the failed call, so its lock remains.

Backend contract v1.2 adds only `publication.pending.state`; endpoints and canonical public bytes/hash are unchanged. The pre-live SDK schema now stores unindexed `title` as UTF-8 bytes so all permitted 120-character titles fit; indexed fields/content are unchanged. Old `str` title entities require a compatibility/version strategy before reuse. No such live entity has been evidenced. Do not copy an old schema into the browser writer: import `BriefmintOpportunitySchema` and `briefmintOpportunityValues`. Query pagination uses numeric offsets; it can shift between blocks. Empty pages with a non-null cursor must be continued. Query failures are errors; malformed public entities may fail a read and must not be treated as an empty catalog. Render text through React text nodes; validate HTTPS contacts and use `rel="noopener noreferrer"` with external tabs.

Arming is an atomic one-winner claim: the first null/null reconciliation of a prepared intent with no known hash returns 202/unknown; another tab/reload gets 409 `PUBLICATION_CONFLICT`. Do not retry arming on 409. GET the brief to inspect an uncertain intent; it cannot be re-prepared, even if its historical state was omitted. After a hash is stored, reconciliation with null hints rechecks that stored hash safely. Successful readback returns 200 and clears pending; a delayed receipt returns 202/submitted; transport failure returns 503 and preserves uncertainty/last-confirmed evidence. An unbound reverted receipt returns 202/reverted, keeps the lock and last-confirmed entity, and must not be described as a successful cancellation.

Independent reader (no wallet or app API): `node --import tsx scripts/briefmint-arkiv-reader.ts --help`. For later read-only network queries, use `--list --public-endpoint --category writing --status open --limit 20`, or load only `ARKIV_ACCESS_KEY` from an ignored env file and omit `--public-endpoint`. See [ARKIV_LIVE_PROBE.md](ARKIV_LIVE_PROBE.md) for exact commands and evidence collection; no actual published record has yet been independently discovered.

## Current frontend gaps to address

- `sessionEpoch` guards private loads but not completion handlers for mutations; stale completions can overwrite the new wallet's view. Guard every asynchronous mutation result/finally update by captured epoch and brief identity.
- Signing must revalidate with server `prepare`, validate/display the intent, then arm uncertainty with null-hint reconciliation before this one wallet attempt. Block every later attempt for unknown/submitted/reverted state.
- Persist non-sensitive pending intent/transaction/entity identifiers durably before dispatch, including SDK errors that may contain a hash. Current React state alone is lost on reload.
- The current browser has no filter/detail controls for public discovery. API reader supports category, status, minimum budget and deadline filters; expose these only when the direct reader implementation can apply them.
- Do not describe the user-facing browser path as complete. Existing local UI may not gate signing with the pending state contract until these changes land.

## Mock versus live

`npm run dev` plus Vite runs the local API/UI integration. Missing inference/quota/auth/Arkiv configuration must show unavailable states and must not silently fall back to demo fixtures. The `0G_LIVE_PROBE.md` is a separate paid-inference gate; do not invoke it during frontend work. Browser signing/discovery requires a public Arkiv access key and a wallet on Rabdi, but secrets embedded in `VITE_*` are public build assets, not secrets. No live record or end-to-end journey is established. Do not create, sign, or publish as part of this handoff.

### Forwardable note to Agent B

Please implement the scoped frontend fixes in this handoff: mutation epoch guards, fresh `prepare` validation, null-hint reconciliation before the single wallet attempt, durable public pending identifiers and honest discovery/detail/error controls. Import the updated shared schema/DTOs; unknown/submitted/reverted states never allow a fresh signature. Start against local API/Vite only. Live inference, signatures, Arkiv writes and deployment need separate authorization; no real record has been evidenced.
