# Tool City

A small city of AI workshops where creators can purchase a private translation, review it beside the source, and reopen the saved result later.

Built for **ETHGlobal Mumbai 2026** by a two-person team.

## Status

Initial project setup. The application and sponsor integrations are planned and have not been implemented or validated yet.

## The idea

Creators who occasionally translate short unpublished announcements should be able to buy one task, correct its output, and recover the result without a subscription or a second purchase.

Our first workshop will translate short English drafts into Hindi. An isometric city will make discovery, payment, processing, and recovery visible through clickable buildings and a document-carrying worker.

## Planned workflow

1. Discover a merchant-owned workshop on Arkiv.
2. Connect a wallet and submit a short draft.
3. Purchase the job with official test USDT on Whitechain.
4. Verify the purchase on the server before private inference through 0G.
5. Review and edit corresponding source/translation segments, then export TXT or JSON.
6. Reopen the existing paid job without buying it again.

## Planned stack

- **Interface:** Next.js, React, SVG and CSS animations.
- **Discovery:** wallet-owned workshop records on Arkiv.
- **Payments:** a fixed-price checkout contract on Whitechain Sepolia.
- **AI:** private inference through 0G Private Computer.
- **Recovery:** authenticated job access and a private SQLite store on persistent hosting.

Private inference does not hide the draft from our application backend. Model quality, availability and end-to-end recovery still need to be tested.

## Team workflow

One builder owns contracts, backend, payment verification and 0G. The other owns the city, frontend and Arkiv. Both work from a shared structure and API contract.

## Development

Setup instructions, deployment addresses, integration evidence and demo links will be added as implementation progresses. No runnable application is included in this initial commit.

AI coding tools assist our planning and development. This initial README was prepared with Codex; implementation-specific attribution will be documented as work is completed.
