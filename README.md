# BriefMint · Tool City

BriefMint helps a community lead turn private project notes into a structured writing or design brief. The owner reviews and edits the result, approves exactly what may become public, and can publish an owner-controlled opportunity on Arkiv for others to discover.

Built for ETHGlobal Mumbai 2026. The city interface uses the existing Tool City visuals; BriefMint does not require payment, escrow, a funded bounty, or Whitechain checkout. The earlier translation and checkout code remains in the repository as a separate legacy product.

## Status

The backend, shared API contract, Vite city integration, and Arkiv adapters are implemented and tested locally. The latest recorded verification passed 126 server tests, five simulated-chain contract tests, both production builds, and a local HTTP proxy/restart smoke. The tests use explicitly labelled synthetic provider and chain fixtures; they are not live sponsor evidence.

The project is **not yet validated end to end**. The remaining gates are:

- A successful authorized 0G private inference. The previous operator-run request returned HTTP 502, with billing uncertain. Independent provider-signature/content verification is not implemented.
- Agent B's browser work: account/session race guards, fresh approval/prepare and exclusive arming before signing, durable pending identifiers, and discovery controls. A real wallet journey remains untested.
- Owner-signed Arkiv create/query/update/close/expiry and an independent live read, plus production HTTPS and persistent-storage verification.

See the [acceptance matrix and verification record](docs/briefmint/backend-checkpoint.md) for precise status and limitations. Do not treat a local build, mock result, prepared intent, or transaction hash alone as proof of a live integration.

## How it works

1. Sign in with a wallet and save private notes with separate public parameters.
2. Deliberately request a structured brief through 0G's private-routing policy. Compilation is controlled by an operator-configured quota, not a purchase.
3. Review and edit the saved draft. The server keeps the original result separate and binds approval to a revision and canonical public-payload hash.
4. Prepare an approved public intent. The owner's browser wallet signs an Arkiv write; the server independently checks the receipt and entity before recording publication.
5. Discover public opportunities by indexed fields or use the standalone reader. Reopen and export the private brief through the owner session.

Private routing does not hide notes from the BriefMint backend. Only reviewed public fields are eligible for publication, but schema validation cannot detect a private fact that a person chooses to approve. Public copies may persist after an opportunity closes or expires.

## Local development

Requires Node.js 24 and npm. Install the root and Vite dependencies from their lockfiles:

```sh
npm ci
npm --prefix apps/web ci
```

For a local, no-inference setup with a disposable database and the correct same-origin proxy/cookie configuration, follow the [local integration runbook](docs/briefmint/local-integration.md). In brief, the Next API listens on `127.0.0.1:4100`, the Vite city on `127.0.0.1:5173`, and the browser uses relative `/api` routes through the Vite proxy. Do not mix `localhost` and `127.0.0.1`. The runbook explains the required session secret and how to leave 0G quota and Arkiv unavailable during local checks; do not commit real environment values.

Useful commands:

```sh
npm run dev -- --hostname 127.0.0.1 --port 4100
npm run reference:dev -- --host 127.0.0.1 --port 5173
npm run test:server
npm run lint
npm run typecheck
npm run build
npm run reference:typecheck
npm run reference:build
npm run smoke:local
```

Run the two development servers in separate terminals after configuring the local environment. `npm run smoke:local` requires the root production build first; it uses loopback servers, a disposable database and test signer, and disables external provider/Arkiv configuration. Legacy contract tests are available with `npm run test:contracts` and run against a simulated chain.

The read-only Arkiv client is independent of the application API, SQLite, login and wallet:

```sh
node --import tsx scripts/briefmint-arkiv-reader.ts --help
```

Its query options and the separately authorized live procedure are documented in the [Arkiv probe](docs/briefmint/ARKIV_LIVE_PROBE.md). No real record has yet been independently discovered by this project.

## Architecture and handoff

- **Browser:** React/Vite city in `apps/web`; the browser wallet owns and signs public Arkiv writes.
- **Backend:** Node/Next API, session-derived ownership, revisioned briefs, quota/lease execution, approval and independent publication reconciliation.
- **Private computation:** 0G private-only routing with fallbacks disabled; Router-reported verification and independent verification are distinct.
- **Public data:** Arkiv indexed opportunity entities with owner and expiry from network system fields. The canonical public DTO is in `src/lib/shared/briefs.ts`.
- **Storage:** private SQLite on a persistent volume, with one Node process. Production HTTPS, proxy routing, backups and restart recovery still require actual hosting evidence.

The [Agent B frontend handoff](docs/briefmint/AGENT_B_FRONTEND_HANDOFF.md) defines the current API and outstanding browser tasks. The [integration contract](docs/briefmint/integration-contract.md) documents the shared boundaries.

## Live validation and submission

Live inference can consume credits, and wallet writes can incur network costs. They require separate human authorization. Follow the [0G live probe](docs/briefmint/0G_LIVE_PROBE.md), [Arkiv live probe](docs/briefmint/ARKIV_LIVE_PROBE.md), and [live validation and submission checklist](docs/briefmint/LIVE_VALIDATION_AND_SUBMISSION.md). [Demo notes](docs/briefmint/DEMO_NOTES.md) provide synthetic input and evidence-safe claims.

The Tool City reference UI came from the recorded `cb0db61` source snapshot and was adapted for BriefMint. AI assistance was used in planning, implementation and testing. A complete third-party asset and dependency license review remains outstanding; do not claim all assets are original until that review is complete.
