import { z } from "zod";
import { createBriefInferenceProvider, type BriefInferenceEnv } from "../../src/lib/server/brief-inference";
import { readBoundedText } from "../../src/lib/server/bounded-body";
import { validateModelResult } from "../../src/lib/shared/briefs";

export const SMOKE_MODEL_ID = "0gm-1.0-35b-a3b";
export const SMOKE_BASE_URL = "https://router-api.0g.ai/v1";
const LIVE_FLAG = "--authorize-paid-inference";
const MAX_TOKENS = 1200;
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
      httpStatus = actual.status; return actual;
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
      responseReference: evidence.responseReference, ...usage(originalResponse) };
    // Even an accidentally echoed credential in provider metadata must never reach logs.
    if (config.inferenceKey && containsCredential(report, config.inferenceKey)) throw new SmokeFailure("METADATA_REDACTED");
    io.log(JSON.stringify(report)); return complete ? 0 : 1;
  } catch (error) {
    const allowed = ["CONFIGURATION_INVALID", "API_KEY_NOT_CONFIGURED", "CATALOG_UNAVAILABLE", "CATALOG_INCOMPATIBLE", "REQUEST_BOUNDARY_VIOLATION", "METADATA_REDACTED", "PROVIDER_UNAVAILABLE", "PROVIDER_FAILED", "EXECUTION_INTERRUPTED"];
    const candidate = error instanceof Error && "code" in error ? String(error.code) : "";
    const code = allowed.includes(candidate) ? candidate : phase === "catalog" ? "CATALOG_UNAVAILABLE" : "PREFLIGHT_FAILED";
    io.error(JSON.stringify({ status: "failed", phase, code, inferenceRequests, httpStatus,
      latencyMs: inferenceStart === null ? null : duration(inferenceStart),
      mayHaveBeenBilled: inferenceRequests > 0, automaticRetry: false }));
    return 1;
  }
}
