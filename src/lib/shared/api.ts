import type { Address, Hex, TranslationSegment } from "./domain";

export type ApiResult<T> = { ok: true; data: T } | {
  ok: false;
  error: { code: string; message: string; retryable: boolean };
};
export type ChallengeResponse = { challengeId: string; message: string; expiresAt: string };
export type SessionResponse = { address: Address; expiresAt: string };
export type VerifyAuthRequest = { challengeId: string; signature: Hex };
export type CreateJobRequest = { workshopEntityKey: Hex; text: string };
export type VerifyPaymentRequest = { txHash: Hex };
export type SaveEditsRequest = { segments: TranslationSegment[] };
