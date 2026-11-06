import { z } from "zod";
import { createBriefInferenceProvider, type BriefInferenceEnv } from "../../src/lib/server/brief-inference";
import { readBoundedText } from "../../src/lib/server/bounded-body";
import { validateModelResult } from "../../src/lib/shared/briefs";

export const SMOKE_MODEL_ID = "0gm-1.0-35b-a3b";
export const SMOKE_BASE_URL = "https://router-api.0g.ai/v1";
const LIVE_FLAG = "--authorize-paid-inference";
const MAX_TOKENS = 1200;
type SafeRouterError = { type: string | null; code: string | null; requestId: string | null };
type SafeResponseMetadata = { requestId: string | null; modelId: string | null; providerId: string | null; routingTier: string | null; routerVerification: boolean | null };
const creditMeasurement = { creditSource: "unverified", promotionalCreditDebit: { status: "not_measured", before: null, after: null, debit: null } } as const;
class SmokeFailure extends Error {
  constructor(readonly code: string) { super(code); }
}
const catalogEntrySchema = z.object({
  id: z.literal(SMOKE_MODEL_ID), type: z.literal("chatbot"), verifiability: z.literal("TeeML"),
  provider_count: z.number().int().positive(), supported_formats: z.array(z.string()).refine(v => v.includes("openai")),
  supported_parameters: z.array(z.string()),
});
const source = [{ id: "seg_001", text: "Synthetic public demo task: make a short checklist for labeling three sample folders." }];
function settings(env: NodeJS.ProcessEnv): BriefInferenceEnv {
  const base = (env.ZERO_G_BASE_URL ?? SMOKE_BASE_URL).replace(/\/$/, "");
  const model = env.ZERO_G_MODEL_ID ?? SMOKE_MODEL_ID;
  const timeout = Number(env.INFERENCE_TIMEOUT_MS ?? "180000");
  if (base !== SMOKE_BASE_URL || model !== SMOKE_MODEL_ID || !Number.isSafeInteger(timeout) || timeout < 1000 || timeout > 180000) {
    throw new SmokeFailure("CONFIGURATION_INVALID");
  }
  return { inferenceBaseUrl: base, modelId: model, inferenceTimeoutMs: timeout, inferenceKey: undefined };
}
const safeCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const safeCost = (value: unknown) => typeof value === "string" && /^\d{1,80}$/.test(value) ? value : null;
function usage(originalResponse?: string) {
  const data = originalResponse ? JSON.parse(originalResponse) : {};
  return {
    reportedTokens: { prompt: safeCount(data.usage?.prompt_tokens), completion: safeCount(data.usage?.completion_tokens), total: safeCount(data.usage?.total_tokens) },
    routerReportedBillingNeurons: { input: safeCost(data.x_0g_trace?.billing?.input_cost), output: safeCost(data.x_0g_trace?.billing?.output_cost), total: safeCost(data.x_0g_trace?.billing?.total_cost) },
  };
}
function containsCredential(value: unknown, key: string): boolean {
  if (typeof value === "string") return value.includes(key);
  return value !== null && typeof value === "object" && Object.values(value).some(item => containsCredential(item, key));
}
function safeToken(value: unknown, credential?: string): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,128}$/.test(value)
    && (!credential || !value.includes(credential)) ? value : null;
}
async function safeRouterError(response: Response, credential?: string): Promise<SafeRouterError> {
  const failure: SafeRouterError = { type: null, code: null,
    requestId: safeToken(response.headers.get("x-request-id") ?? response.headers.get("x-0g-request-id"), credential) };
  try {
    const body = JSON.parse(await readBoundedText(response.body, 16000));
    failure.type = safeToken(body?.error?.type, credential);
    failure.code = safeToken(body?.error?.code, credential);
    failure.requestId ??= safeToken(body?.request_id ?? body?.x_0g_trace?.request_id, credential);
  } catch { /* Never replace the provider's original response/error with diagnostic parsing. */ }
  return failure;
}
function safeResponseMetadata(response: Response, raw: string, credential?: string): SafeResponseMetadata {
  const metadata: SafeResponseMetadata = { requestId: safeToken(response.headers.get("x-request-id") ?? response.headers.get("x-0g-request-id"), credential), modelId: null, providerId: null, routingTier: null, routerVerification: null };
  try {
    const body = JSON.parse(raw);
    metadata.requestId ??= safeToken(body?.x_0g_trace?.request_id ?? body?.id, credential);
    metadata.modelId = safeToken(body?.model, credential);
    metadata.providerId = safeToken(body?.x_0g_trace?.provider_address ?? body?.x_0g_trace?.provider, credential);
    metadata.routingTier = safeToken(body?.x_0g_trace?.trust_mode ?? body?.x_0g_trace?.routing_tier, credential);
    metadata.routerVerification = typeof body?.x_0g_trace?.tee_verified === "boolean" ? body.x_0g_trace.tee_verified : null;
  } catch { /* Malformed response diagnostics must remain bounded and content-free. */ }
  return metadata;
}
/** No file/env loader, database, wallet, payment or Arkiv imports. Native fetch has no retry policy. */
export async function runBriefmintSmoke(args: string[], env: NodeJS.ProcessEnv, io: {
  log: (line: string) => void; error: (line: string) => void;
}, fetcher: typeof fetch = fetch, clock = () => performance.now()): Promise<number> {
  if (args.length !== 1 || !["--preflight", LIVE_FLAG].includes(args[0])) {
    io.error("Refusing inference: use --preflight for public catalog only, or --authorize-paid-inference after explicit authorization.");
    return 2;
  }
  let config: BriefInferenceEnv | undefined; let phase = "configuration";
  let inferenceRequests = 0; let inferenceStart: number | null = null; let httpStatus: number | null = null;
  let routerError: SafeRouterError | null = null;
  let providerMetadata: SafeResponseMetadata | null = null;
  const duration = (start: number) => Math.max(0, Math.round(clock() - start));
  try {
    config = settings(env);
    // The preflight-only path never reads ZERO_G_API_KEY and never sends Authorization.
    if (args[0] === LIVE_FLAG) {
      const key = env.ZERO_G_API_KEY;
      if (!key || key !== key.trim() || /[\r\n]/.test(key)) throw new SmokeFailure("API_KEY_NOT_CONFIGURED");
      config.inferenceKey = key;
    }
    phase = "catalog";
    const catalogStart = clock();
    const response = await fetcher(`${SMOKE_BASE_URL}/models`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) { await response.body?.cancel(); throw new SmokeFailure("CATALOG_UNAVAILABLE"); }
    const catalog = JSON.parse(await readBoundedText(response.body, 2_000_000));
    if (!Array.isArray(catalog.data)) throw new SmokeFailure("CATALOG_INCOMPATIBLE");
    const matches = catalog.data.filter((item: unknown) => item !== null && typeof item === "object" && "id" in item && item.id === SMOKE_MODEL_ID);
    if (matches.length !== 1) throw new SmokeFailure("CATALOG_INCOMPATIBLE");
    const model = catalogEntrySchema.safeParse(matches[0]);
    if (!model.success || !["max_tokens", "response_format", "chat_template_kwargs"].every(p => model.data.supported_parameters.includes(p))) {
      throw new SmokeFailure("CATALOG_INCOMPATIBLE");
    }
    const preflight = { smokeVersion: "briefmint.smoke.v1", checkedAt: new Date().toISOString(), requestedModel: SMOKE_MODEL_ID,
      catalog: { verifiability: model.data.verifiability, providerCount: model.data.provider_count, latencyMs: duration(catalogStart) },
      policy: { trustMode: "private", allowFallbacks: false, verifyTee: true, redirects: false, retries: 0,
        maxInferenceRequests: 1, requestedMaxOutputTokens: MAX_TOKENS, timeoutMs: config.inferenceTimeoutMs, thinkingRequested: false, jsonModeRequested: true } };
    if (args[0] === "--preflight") {
      io.log(JSON.stringify({ status: "catalog_ready", ...preflight, inferenceRequests: 0,
        note: "Catalog compatibility only; capacity, credits and response verification are not proven." }));
      return 0;
    }
    phase = "inference";
    const singleRequestFetch: typeof fetch = async (url, init) => {
      if (inferenceRequests !== 0 || String(url) !== `${SMOKE_BASE_URL}/chat/completions` || init?.method !== "POST") throw new SmokeFailure("REQUEST_BOUNDARY_VIOLATION");
      inferenceRequests++;
      const actual = await fetcher(url, { ...init, redirect: "error" });
      httpStatus = actual.status;
      if (!actual.ok) routerError = await safeRouterError(actual, config?.inferenceKey);
      else {
        // Consume once: cancelling an oversized cloned stream can wait forever for its unread twin.
        let raw: string;
        try { raw = await readBoundedText(actual.body, 100000); }
        catch { throw new SmokeFailure("PROVIDER_FAILED"); }
        providerMetadata = safeResponseMetadata(actual, raw, config?.inferenceKey);
        return new Response(raw, { status: actual.status, headers: actual.headers });
      }
      return actual;
    };
    const provider = createBriefInferenceProvider(config, singleRequestFetch, { maxTokens: MAX_TOKENS, disableThinking: true, jsonMode: true });
    provider.assertReady(); inferenceStart = clock();
    const { result, evidence, originalResponse } = await provider.compile(source, {
      title: "Synthetic folder checklist", summary: "A harmless synthetic example used only to verify provider wiring.",
      category: "writing", language: "en", budgetUsdCents: null, deadline: new Date(Date.now() + 86400000).toISOString(), contactUrl: null,
    });
    phase = "validation"; validateModelResult(result, source);
    const complete = !!evidence.requestId && evidence.modelId === SMOKE_MODEL_ID && !!evidence.providerId && evidence.routerVerification === true;
    const report = { status: complete ? "completed" : "completed_evidence_incomplete", ...preflight,
      inferenceRequests, latencyMs: duration(inferenceStart), httpStatus, structuredResponseValid: true,
      requestId: evidence.requestId, returnedModel: evidence.modelId, providerId: evidence.providerId, routingTier: evidence.routingTier,
      routerVerification: evidence.routerVerification, independentResponseVerification: evidence.independentResponseVerification,
      independentVerificationReason: "Provider signature, chain-registered signer and signed-content comparison are not implemented by this probe.",
      responseReference: evidence.responseReference, automaticRetry: false, mayHaveBeenBilled: true, ...creditMeasurement, ...usage(originalResponse) };
    // Even an accidentally echoed credential in provider metadata must never reach logs.
    if (config.inferenceKey && containsCredential(report, config.inferenceKey)) throw new SmokeFailure("METADATA_REDACTED");
    io.log(JSON.stringify(report)); return complete ? 0 : 1;
  } catch (error) {
    const allowed = ["CONFIGURATION_INVALID", "API_KEY_NOT_CONFIGURED", "CATALOG_UNAVAILABLE", "CATALOG_INCOMPATIBLE", "REQUEST_BOUNDARY_VIOLATION", "METADATA_REDACTED", "PROVIDER_UNAVAILABLE", "PROVIDER_FAILED", "EXECUTION_INTERRUPTED"];
    const candidate = error instanceof Error && "code" in error ? String(error.code) : "";
    const code = allowed.includes(candidate) ? candidate : phase === "catalog" ? "CATALOG_UNAVAILABLE" : "PREFLIGHT_FAILED";
    const report = { status: "failed", phase, code, inferenceRequests, httpStatus, routerError, providerMetadata,
      latencyMs: inferenceStart === null ? null : duration(inferenceStart),
      mayHaveBeenBilled: inferenceRequests > 0, automaticRetry: false, ...creditMeasurement };
    if (!config?.inferenceKey || !containsCredential(report, config.inferenceKey)) io.error(JSON.stringify(report));
    else io.error(JSON.stringify({ ...report, routerError: null, providerMetadata: null, code: "METADATA_REDACTED" }));
    return 1;
  }
}
