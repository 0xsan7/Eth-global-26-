# BriefMint · Tool City

BriefMint helps a community lead turn private project notes into a structured writing or design brief. The owner reviews and edits the result, approves exactly what may become public, and can publish an owner-controlled opportunity on Arkiv for others to discover.

Built for ETHGlobal Mumbai 2026. The city interface uses the existing Tool City visuals; BriefMint does not require payment, escrow, a funded bounty, or Whitechain checkout. The earlier translation and checkout code remains in the repository as a separate legacy product.

## Status

The backend, shared API contract, Next-hosted city integration, and Arkiv adapters are implemented and tested locally. The latest recorded verification passed 126 server tests, five simulated-chain contract tests, both production builds, and a local HTTP proxy/restart smoke. The tests use explicitly labelled synthetic provider and chain fixtures; they are not live sponsor evidence.

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

Requires Node.js 24 and npm. Install the root dependencies from the lockfile:

```sh
npm ci
```

For a local, no-inference setup with a disposable database, follow the [local integration runbook](docs/briefmint/local-integration.md). The runbook explains the required session secret and how to leave 0G quota and Arkiv unavailable during local checks; do not commit real environment values. (Its Vite two-server proxy layout describes the archived `apps/web` setup; this branch hosts the city in the Next app, so the browser calls same-origin `/api` directly.)

Useful commands:

```sh
npm run dev
npm run test:server
npm run test:ui
npm run lint
npm run typecheck
npm run build
npm run smoke:local
```

