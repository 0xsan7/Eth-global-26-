# Tool City implementation rules

- Read `docs/san-backend-payments.md` and `docs/briefs/TOOL-CITY-COMMON-STRUCTURE.md` before implementation.
- Keep the approved one-merchant text translation scope. Do not add voice, gasless checkout, Storage or extra paid services.
- Work on `codex/` branches. The user authorizes main merge only after every full-project readiness gate in the staged plan passes. Local tests alone do not meet this condition.
- The requested technical coordinator is `gpt-6.1-sol` with high reasoning. Delegate bounded contract/complex work to `gpt-6.1-terra` high; use `gpt-6-luna` medium for documentation and mechanical support. Independently review sensitive changes. Do not pretend this file changes the parent chat's selected model.
- One owner edits root toolchain/shared contracts/lockfile. Backend owns server/API/contracts; teammate owns browser city/Arkiv. Do not edit teammate files after the agreed bootstrap without coordination.
- No secrets or private drafts in Git, browser bundles, public records or logs. Live integration evidence must be real and clearly distinguished from local doubles.
- Keep purchase/entitlement checks fail-closed. Missing Arkiv integration, payment verification or required private capacity must not silently bypass the gate.
- Record exact checks and remaining live gates in `docs/backend-handoff.md`. Never claim a push, deployment, model run or verification that did not occur.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
