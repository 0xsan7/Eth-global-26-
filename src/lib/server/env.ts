import "server-only";
import { unavailable } from "./errors";

export type ServerEnv = {
  appOrigin: string; allowedOrigins: string[]; sessionSecret: string;
  databasePath: string; rpcUrl: string | undefined; inferenceKey: string | undefined;
  inferenceBaseUrl: string; modelId: string | undefined; inferenceTimeoutMs: number;
  paymentConfirmations: number; secureCookies: boolean;
};
function integer(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw unavailable("Invalid server limits.");
  return parsed;
}
function origin(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value) throw unavailable("Invalid application origin.");
  return parsed.origin;
}
export function getServerEnv(): ServerEnv {
  try {
    const appOrigin = origin(process.env.APP_ORIGIN ?? "http://localhost:3000");
    if (process.env.NODE_ENV === "production" && !appOrigin.startsWith("https://")) throw unavailable("Production requires HTTPS.");
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) throw unavailable("Session configuration is unavailable.");
    const inferenceBaseUrl = process.env.ZERO_G_BASE_URL ?? "https://router-api.0g.ai/v1";
    if (new URL(inferenceBaseUrl).protocol !== "https:") throw unavailable("Inference requires HTTPS.");
    return { appOrigin, allowedOrigins: [...new Set([appOrigin, ...(process.env.AUTH_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean).map(origin)])],
      sessionSecret, databasePath: process.env.DATABASE_PATH ?? "./data/tool-city.sqlite",
      rpcUrl: process.env.WHITECHAIN_RPC_URL, inferenceKey: process.env.ZERO_G_API_KEY,
      inferenceBaseUrl, modelId: process.env.ZERO_G_MODEL_ID,
      inferenceTimeoutMs: integer(process.env.INFERENCE_TIMEOUT_MS, 60000, 1000, 180000),
      paymentConfirmations: integer(process.env.PAYMENT_CONFIRMATIONS, 3, 1, 100),
      secureCookies: appOrigin.startsWith("https://") };
  } catch (error) { if (error instanceof Error && error.name === "TypeError") throw unavailable("Invalid server configuration."); throw error; }
}
