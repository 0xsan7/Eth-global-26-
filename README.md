# BriefMint · Tool City

BriefMint helps a community lead turn private project notes into a structured writing or design brief. The owner reviews and edits the result, approves exactly what may become public, and can publish an owner-controlled opportunity on Arkiv for others to discover.

Built for ETHGlobal Mumbai 2026. The city interface uses the existing Tool City visuals (SVG neighbourhood plus an emulator-style Pixi layer with quest markers); BriefMint does not require payment, escrow, a funded bounty, or Whitechain checkout. The earlier translation and checkout code remains in the repository as a separate legacy product.

## Status

Full-stack foundation on `briefmint/fullstack` (tagged `v1`): the canonical backend (contract v1.2, lifecycle services, quota/lease runner, private compiler, revision-bound approval, publication intents, SDK Arkiv adapter, migrations) merged with the Next-hosted HUD city wired to that contract. Last recorded verification: typecheck, lint, 27 UI tests, 126 server tests, 5 simulated-chain contract tests, and a production build. The tests use explicitly labelled synthetic provider and chain fixtures; they are not live sponsor evidence.

The project is **not yet validated end to end**. The remaining gates are:

- A successful authorized 0G private inference. A previous operator-run request returned HTTP 502, with billing uncertain. Independent provider-signature/content verification is not implemented.
- A real wallet journey: connect, sign in, compile, approve, prepare, sign an Arkiv write, reconcile, refresh and recover.
- Owner-signed Arkiv create/query/update/close/expiry and an independent live read, plus production HTTPS and persistent-storage verification.

See the [acceptance matrix and verification record](docs/briefmint/backend-checkpoint.md) for precise status and limitations. Do not treat a local build, mock result, prepared intent, or transaction hash alone as proof of a live integration.

## How it works

1. Sign in with a wallet and save private notes with separate public parameters.
2. Deliberately request a structured brief through 0G's private-routing policy. Compilation is controlled by an operator-configured quota, not a purchase.
3. Review and edit the saved draft. The server keeps the original result separate and binds approval to a revision and canonical public-payload hash.
4. Prepare an approved public intent. The owner's browser wallet signs an Arkiv write; the server independently checks the receipt and entity before recording publication.
5. Discover public opportunities by indexed fields or use the standalone reader. Reopen and export the private brief through the owner session.

Private routing does not hide notes from the BriefMint backend. Only reviewed public fields are eligible for publication, but schema validation cannot detect a private fact that a person chooses to approve. Public copies may persist after an opportunity closes or expires.

## Repository map

- **Browser city:** Next.js App Router pages (`src/app/` — `/` city, `/briefs`, `/briefs/[id]`, `/opportunities`, plus legacy `/jobs`, `/merchant`), isometric SVG + Pixi scene (`src/components/city/`), BriefMint panels (`src/components/briefs/`), typed API hooks (`src/lib/client/`).
- **Backend:** Node/Next API routes (`src/app/api/briefs/*`, `/api/briefmint/config`, legacy `/api/jobs/*`), session-derived ownership, revisioned briefs, quota/lease execution, approval and independent publication reconciliation (`src/lib/server/`).
- **Shared contract (frozen v1.2):** `src/lib/shared/briefs.ts` — DTOs, zod schemas, canonical JSON/SHA-256 hashing, approval semantics and the `briefApi` method/path registry. Neither side redefines DTOs.
- **Public data:** Arkiv indexed opportunity entities with owner and expiry from network system fields (`src/lib/arkiv/briefmint/`, `scripts/briefmint-arkiv-reader.ts`). The canonical public DTO is in the shared module.
- **Storage:** private SQLite on a persistent volume, with one Node process.

The [canonical integration contract](docs/briefmint/integration-contract.md), [Agent B handoff](docs/briefmint/agent-b-handoff.md) (browser tasks, wallet flow, local setup), [full-stack merge notes](docs/briefmint-frontend-handoff.md) and [setup guide](docs/SETUP-LIVE-INTEGRATIONS.md) document the shared boundaries.

## Local development

Requires Node.js 24 and npm. From the repository root:

```sh
npm ci
cp .env.example .env.local
```

Set a local `SESSION_SECRET` (32+ characters) in `.env.local` before using authenticated APIs. Then:

```sh
npm run dev
```

The app serves at `http://localhost:3000` with same-origin `/api` routes. Private notes, compilation, and publication stay fail-closed until the operator configures: 0G credentials (`ZERO_G_API_KEY`, `ZERO_G_MODEL_ID`), the quota policy (`BRIEFMINT_*` — empty allowlist disables compilation), and Arkiv access (`ARKIV_ACCESS_KEY`, a public rate-limit key, not a wallet credential). Never commit real values; do not put keys in chat, browser output, or public records. The browser's independent reader and publisher take the Arkiv key as local UI input instead. See `.env.example` for the full variable list and [live setup](docs/SETUP-LIVE-INTEGRATIONS.md) for wallet funding and 0G access.

Validation commands:

```sh
npm run typecheck
npm run lint
npm run test:server
npm run test:ui
npm run test:contracts
npm run build
npm run smoke:local
```

`npm run test` runs server + UI suites. `npm run build` packages the standalone checkout example and prepares standalone public/static assets; `npm start` runs that build. Production requires HTTPS configuration and a persistent `DATABASE_PATH` on one Node instance.

## Live validation and submission

Live inference can consume credits, and wallet writes can incur network costs. They require separate human authorization. Follow the [0G live probe](docs/briefmint/0G_LIVE_PROBE.md), [Arkiv live probe](docs/briefmint/ARKIV_LIVE_PROBE.md), and [live validation and submission checklist](docs/briefmint/LIVE_VALIDATION_AND_SUBMISSION.md). [Demo notes](docs/briefmint/DEMO_NOTES.md) provide synthetic input and evidence-safe claims — never use real private notes for smoke checks.

## Privacy and attribution

Your source notes and private draft are stored in BriefMint's backend so you can compile, edit, and recover them. The backend processes your notes through the configured private inference route. Private routing does not hide notes from the application backend. Storage uses access-controlled SQLite; this demo does not promise application-level encryption or deletion from host backups. Only fields you review and approve are eligible for public export or publication. Public copies may persist after a record is closed or expires.

AI assistance was used in planning, implementation and testing. A complete third-party asset and dependency license review remains outstanding; do not claim all assets are original until that review is complete.
