import { describe, expect, it } from "vitest";
import { runBriefmintSmoke, SMOKE_BASE_URL, SMOKE_MODEL_ID } from "../../scripts/lib/briefmint-smoke";

const flag = "--authorize-paid-inference";
const syntheticKey = "synthetic-credential-never-log-this";
const model = { id: SMOKE_MODEL_ID, type: "chatbot", verifiability: "TeeML", provider_count: 1,
  supported_formats: ["openai"], supported_parameters: ["max_tokens", "response_format", "chat_template_kwargs"] };
const item = { text: "Checklist for three sample folders", sourceIds: ["seg_001"], basis: "provided" };
const result = { deliverables: [item], acceptanceCriteria: [item], exclusions: [], openQuestions: [] };
function reply(patch: Record<string, unknown> = {}) {
  return Response.json({ id: "completion-real-test-double", model: SMOKE_MODEL_ID,
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }],
    x_0g_trace: { request_id: "router-real-test-double", provider: `0x${"1".repeat(40)}`, trust_mode: "private", tee_verified: true,
      billing: { input_cost: "10", output_cost: "20", total_cost: "30" } },
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }, ...patch }, { headers: { "ZG-Res-Key": "signature-reference-test-double" } });
}
function setup(options: { catalog?: unknown; completion?: () => Response | Promise<Response> } = {}) {
  const lines: string[] = []; const errors: string[] = []; const requests: { url: string; init?: RequestInit }[] = [];
  let milliseconds = 0;
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init }); milliseconds += 25;
    return String(url).endsWith("/models") ? Response.json({ data: [options.catalog ?? model] }) : options.completion?.() ?? reply();
  };
  return { lines, errors, requests, run: (args = [flag], env: NodeJS.ProcessEnv = { NODE_ENV: "test", ZERO_G_API_KEY: syntheticKey }) =>
    runBriefmintSmoke(args, env, { log: v => lines.push(v), error: v => errors.push(v) }, fetcher, () => milliseconds) };
}

describe("guarded 0G smoke — injected network only", () => {
  it("requires exact authorization before any network operation", async () => {
    for (const args of [[], ["--authorize"], [flag, "extra"]]) {
      const test = setup(); expect(await test.run(args)).toBe(2); expect(test.requests).toHaveLength(0);
    }
    const missing = setup(); expect(await missing.run([flag], { NODE_ENV: "test" })).toBe(1); expect(missing.requests).toHaveLength(0);
    expect(JSON.parse(missing.errors[0]).code).toBe("API_KEY_NOT_CONFIGURED");
  });
  it("preflight reads only the public catalog, never the key or session configuration", async () => {
    const test = setup(); const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
    Object.defineProperty(env, "ZERO_G_API_KEY", { get() { throw new Error("Key must not be read"); } });
    expect(await test.run(["--preflight"], env)).toBe(0);
    expect(test.requests).toHaveLength(1); expect(test.requests[0]).toMatchObject({ url: `${SMOKE_BASE_URL}/models`, init: { method: "GET", redirect: "error" } });
    expect(test.requests[0].init?.headers).toBeUndefined();
    expect(JSON.parse(test.lines[0])).toMatchObject({ status: "catalog_ready", inferenceRequests: 0 });
  });
  it.each([
    { ...model, verifiability: "TeeTLS" }, { ...model, provider_count: 0 },
    { ...model, supported_parameters: ["max_tokens"] }, { ...model, id: "different-model" },
    { ...model, type: "embedding" },
  ])("blocks incompatible catalog entries before any credentialed POST", async entry => {
    const test = setup({ catalog: entry }); expect(await test.run()).toBe(1);
    expect(test.requests).toHaveLength(1); expect(test.requests[0].init?.headers).toBeUndefined();
    expect(JSON.parse(test.errors[0]).code).toBe("CATALOG_INCOMPATIBLE");
  });
  it("pins endpoint/model and bounded timeout before reading a key or making requests", async () => {
    for (const patch of [{ ZERO_G_BASE_URL: "https://other.invalid/v1" }, { ZERO_G_MODEL_ID: "unreviewed" }, { INFERENCE_TIMEOUT_MS: "180001" }]) {
      const test = setup(); expect(await test.run([flag], { NODE_ENV: "test", ZERO_G_API_KEY: syntheticKey, ...patch })).toBe(1);
      expect(test.requests).toHaveLength(0);
    }
  });
  it("sends one bounded private synthetic completion and reports genuine metadata and latency", async () => {
    const test = setup(); expect(await test.run()).toBe(0); expect(test.requests).toHaveLength(2);
    const completion = test.requests[1];
    expect(completion.init).toMatchObject({ method: "POST", redirect: "error", headers: {
      "X-0G-Provider-Trust-Mode": "private", "X-0G-Provider-Allow-Fallbacks": "false" } });
    const body = JSON.parse(completion.init!.body as string);
    expect(body).toMatchObject({ model: SMOKE_MODEL_ID, stream: false, verify_tee: true, max_tokens: 1200,
      chat_template_kwargs: { enable_thinking: false }, response_format: { type: "json_object" } });
    expect(JSON.parse(body.messages[1].content).source[0].text).toContain("Synthetic public demo");
    const report = JSON.parse(test.lines[0]);
    expect(report).toMatchObject({ status: "completed", inferenceRequests: 1, latencyMs: 25, structuredResponseValid: true,
      requestId: "router-real-test-double", returnedModel: SMOKE_MODEL_ID, providerId: `0x${"1".repeat(40)}`,
      routerVerification: true, independentResponseVerification: "unavailable", responseReference: "signature-reference-test-double",
      creditSource: "unverified", promotionalCreditDebit: { status: "not_measured", before: null, after: null, debit: null },
      reportedTokens: { prompt: 100, completion: 200, total: 300 }, routerReportedBillingNeurons: { total: "30" } });
    expect(test.lines.join("\n")).not.toMatch(/synthetic-credential|Authorization|sample folders/);
  });
  it("keeps missing evidence unknown and marks the run incomplete without another request", async () => {
    const test = setup({ completion: () => reply({ id: undefined, model: undefined, x_0g_trace: {} }) });
    expect(await test.run()).toBe(1);
    expect(JSON.parse(test.lines[0])).toMatchObject({ status: "completed_evidence_incomplete", requestId: null, returnedModel: null,
      providerId: null, routerVerification: null, independentResponseVerification: "unavailable" });
    expect(test.requests).toHaveLength(2);
  });
  it("rejects invalid structured output and never retries a potentially billed response", async () => {
    const test = setup({ completion: () => reply({ choices: [{ message: { content: '{"deliverables":[]}' } }] }) });
    expect(await test.run()).toBe(1); expect(test.requests).toHaveLength(2); expect(test.lines).toEqual([]);
    expect(JSON.parse(test.errors[0])).toMatchObject({ code: "PROVIDER_FAILED", inferenceRequests: 1, mayHaveBeenBilled: true, automaticRetry: false });
    expect(JSON.parse(test.errors[0]).providerMetadata).toMatchObject({ requestId: "router-real-test-double", modelId: SMOKE_MODEL_ID, providerId: `0x${"1".repeat(40)}` });
  });
  it("bounds oversized successful and error bodies without retrying or logging response text", async () => {
    for (const status of [200, 502]) {
      const test = setup({ completion: () => new Response("SYNTHETIC_PRIVATE_CANARY".repeat(5000), { status }) });
      expect(await test.run()).toBe(1);
      expect(test.requests).toHaveLength(2); expect(test.lines).toEqual([]);
      expect(test.errors.join("\n")).not.toContain("SYNTHETIC_PRIVATE_CANARY");
      expect(JSON.parse(test.errors[0])).toMatchObject({ httpStatus: status, inferenceRequests: 1, automaticRetry: false });
    }
  });
  it.each([syntheticKey, 'synthetic-"quoted\\credential'])("does not log credentials even if a provider echoes them in metadata", async key => {
    const test = setup({ completion: () => reply({ x_0g_trace: { request_id: key, provider: "provider", tee_verified: true } }) });
    expect(await test.run([flag], { NODE_ENV: "test", ZERO_G_API_KEY: key })).toBe(1); expect(test.lines).toEqual([]);
    expect(test.errors.join("\n")).not.toContain(key);
    expect(JSON.parse(test.errors[0]).code).toBe("PROVIDER_FAILED"); // The adapter rejects the echo before producing evidence.
  });
  it.each([503, 302])("does not retry or follow an inference HTTP %i", async status => {
    const test = setup({ completion: () => new Response("sensitive upstream details", { status, headers: { Location: "https://other.invalid" } }) });
    expect(await test.run()).toBe(1); expect(test.requests).toHaveLength(2);
    expect(test.requests[1].init?.redirect).toBe("error"); expect(test.errors.join("\n")).not.toContain("sensitive");
  });
  it("reports only allowlisted 0G error metadata while suppressing the raw error message", async () => {
    const test = setup({ completion: () => Response.json({
      error: { type: "server_error", code: "provider_error", message: `sensitive prompt ${syntheticKey}` }, request_id: "req_safe-123",
    }, { status: 502 }) });
    expect(await test.run()).toBe(1); expect(test.requests).toHaveLength(2);
    const report = JSON.parse(test.errors[0]);
    expect(report).toMatchObject({ httpStatus: 502, routerError: { type: "server_error", code: "provider_error", requestId: "req_safe-123" },
      mayHaveBeenBilled: true, automaticRetry: false });
    expect(test.errors.join("\n")).not.toMatch(/sensitive prompt|synthetic-credential|message/);
  });
  it("reports uncertain aborted outcomes without retrying or printing exception diagnostics", async () => {
    const test = setup({ completion: async () => { throw new DOMException("sensitive input and credential", "TimeoutError"); } });
    expect(await test.run()).toBe(1); expect(test.requests).toHaveLength(2);
    expect(JSON.parse(test.errors[0])).toMatchObject({ code: "EXECUTION_INTERRUPTED", mayHaveBeenBilled: true, automaticRetry: false });
    expect(test.errors.join("\n")).not.toMatch(/sensitive|credential/);
  });
});
