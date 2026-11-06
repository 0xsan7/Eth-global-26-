import type { Address, Hex, JobSummary, MerchantPurchase, PublicConfig, TranslationSegment } from "./domain";

export type ApiResult<T> = { ok: true; data: T } | {
  ok: false;
  error: { code: string; message: string; retryable: boolean };
};
export type ChallengeResponse = { challengeId: string; message: string; expiresAt: string };
export type VerifyResponse = { address: Address; expiresAt: string };
export type SessionResponse = { address: Address; expiresAt: string };
export type LogoutResponse = { loggedOut: true };
export type VerifyAuthRequest = { challengeId: string; signature: Hex };
export type CreateJobRequest = { workshopEntityKey: Hex; text: string };
export type VerifyPaymentRequest = { txHash: Hex };
export type SaveEditsRequest = { segments: TranslationSegment[] };
export type PatchEditsRequest = { segments: TranslationSegment[] };
export type JobsListResponse = { jobs: JobSummary[] };
export type MerchantPurchasesResponse = { purchases: MerchantPurchase[] };
export type ConfigResponse = PublicConfig;
