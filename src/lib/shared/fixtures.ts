import type { JobStatus, JobView, WorkshopView } from "./domain";

// UI development only. These are labelled local examples, never live evidence.
export function developmentJob(status: JobStatus = "awaiting_payment"): JobView {
  const id = `0x${"a1".repeat(32)}` as const;
  return {
    id, buyerAddress: "0x1111111111111111111111111111111111111111", workshopEntityKey: `0x${"b2".repeat(32)}`,
    sourceLang: "en", targetLang: "hi", status,
    sourceSegments: [{ id: "seg_001", text: "Join us on Friday at 5 PM." }],
    terms: {
      chainId: 1874, checkoutAddress: "0x2222222222222222222222222222222222222222",
      tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7", tokenDecimals: 6, amountAtomic: "1000000",
      merchantAddress: "0x3333333333333333333333333333333333333333", serviceId: id, termsHash: id,
    },
    payment: null, modelSegments: status === "ready" ? [{ id: "seg_001", text: "शुक्रवार शाम 5 बजे हमसे जुड़ें।" }] : null,
    editedSegments: null, evidence: null, attemptsUsed: status === "awaiting_payment" ? 0 : 1,
    retryEligible: false, error: status === "interrupted" ? { code: "DEVELOPMENT_FIXTURE", message: "Simulated interruption." } : null,
    createdAt: "2026-11-06T00:00:00.000Z", updatedAt: "2026-11-06T00:00:00.000Z",
  };
}

export const DEV_FIXTURE_WORKSHOP: WorkshopView = {
  entityKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ownerAddress: "0x000000000000000000000000000000000000dEaD",
  title: "Demo Workshop (fixture - not live)",
  description: "Labelled fixture used while backend/Arkiv is absent.",
  active: true,
  sourceLang: "en",
  targetLang: "hi",
  jobType: "text.translate",
  checkoutChainId: 1874,
  checkoutAddress: "0x0000000000000000000000000000000000000000",
  serviceId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  termsHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  expiresAtBlock: null,
  fetchedAt: new Date(0).toISOString(),
  freshness: "stale",
  supported: false,
};

export const DEV_FIXTURE_JOB: JobView = {
  id: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  buyerAddress: "0x000000000000000000000000000000000000dEaD",
  workshopEntityKey: DEV_FIXTURE_WORKSHOP.entityKey,
  sourceLang: "en",
  targetLang: "hi",
  status: "awaiting_payment",
  sourceSegments: [{ id: "seg_001", text: "Fixture source text (not live)." }],
  terms: {
    chainId: 1874,
    checkoutAddress: "0x0000000000000000000000000000000000000000",
    tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
    tokenDecimals: 6,
    amountAtomic: "1000000",
    merchantAddress: "0x000000000000000000000000000000000000dEaD",
    serviceId: DEV_FIXTURE_WORKSHOP.serviceId,
    termsHash: DEV_FIXTURE_WORKSHOP.termsHash,
  },
  payment: null,
  modelSegments: null,
  editedSegments: null,
  evidence: null,
  attemptsUsed: 0,
  retryEligible: false,
  error: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

export function devFixturesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_DEV_FIXTURES === "true";
}
