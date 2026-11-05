import type { JobStatus, JobView } from "./domain";

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
    payment: null, modelSegments: status === "ready" ? [{ id: "seg_001", text: "शुक्रवार को शाम 5 बजे हमारे साथ जुड़ें।" }] : null,
    editedSegments: null, evidence: null, attemptsUsed: status === "awaiting_payment" ? 0 : 1,
    retryEligible: false, error: status === "interrupted" ? { code: "DEVELOPMENT_FIXTURE", message: "Simulated interruption." } : null,
    createdAt: "2026-11-06T00:00:00.000Z", updatedAt: "2026-11-06T00:00:00.000Z",
  };
}
