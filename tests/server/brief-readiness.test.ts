import { afterEach, describe, expect, it, vi } from "vitest";
import { handleBrief } from "../../src/lib/server/brief-http";
import { getServerEnv, type ServerEnv } from "../../src/lib/server/env";
import { createArkivBriefmintReader } from "../../src/lib/arkiv/briefmint/read";

// Public config composition uses local doubles; no RPC or credential files are read.
vi.mock("../../src/lib/server/env", () => ({ getServerEnv: vi.fn() }));
vi.mock("../../src/lib/arkiv/briefmint/read", () => ({ createArkivBriefmintReader: vi.fn() }));
const env: ServerEnv = { appOrigin: "https://briefmint.invalid", allowedOrigins: ["https://briefmint.invalid"],
  sessionSecret: "synthetic-session-value", databasePath: ":memory:", rpcUrl: undefined,
  inferenceKey: undefined, inferenceBaseUrl: "https://router.invalid/v1", modelId: undefined,
  inferenceTimeoutMs: 1000, paymentConfirmations: 3, secureCookies: true };
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe("BriefMint public readiness composition", () => {
  it("probes the configured reader through the real config handler without exposing endpoint keys", async () => {
    vi.mocked(getServerEnv).mockReturnValue({ ...env, arkivAccessKey: "synthetic-public-endpoint-key" });
    const readiness = vi.fn(async () => true);
    vi.mocked(createArkivBriefmintReader).mockReturnValue({ readiness } as unknown as ReturnType<typeof createArkivBriefmintReader>);
    const response = await handleBrief("config", new Request("https://briefmint.invalid/api/briefmint/config"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.arkiv.readiness.available).toBe(true); expect(body.data.auth.chainId).toBe(7794095);
    expect(body.data.compilation.available).toBe(false); expect(readiness).toHaveBeenCalledOnce();
    expect(JSON.stringify(body)).not.toMatch(/synthetic-|sessionSecret|arkivAccessKey|Whitechain/);
  });
  it("reports failed or missing reader configuration as unavailable", async () => {
    vi.mocked(getServerEnv).mockReturnValue(env);
    let response = await handleBrief("config", new Request("https://briefmint.invalid/api/briefmint/config"));
    expect((await response.json()).data.arkiv.readiness.available).toBe(false);
    expect(createArkivBriefmintReader).not.toHaveBeenCalled();
    vi.mocked(getServerEnv).mockReturnValue({ ...env, arkivAccessKey: "synthetic-public-endpoint-key" });
    vi.mocked(createArkivBriefmintReader).mockReturnValue({ readiness: async () => { throw new Error("synthetic private diagnostic"); } } as unknown as ReturnType<typeof createArkivBriefmintReader>);
    response = await handleBrief("config", new Request("https://briefmint.invalid/api/briefmint/config"));
    const body = await response.json(); expect(body.data.arkiv.readiness.available).toBe(false);
    expect(JSON.stringify(body)).not.toContain("synthetic private diagnostic");
  });
  it("bounds a stalled public readiness probe to five seconds", async () => {
    vi.useFakeTimers();
    vi.mocked(getServerEnv).mockReturnValue({ ...env, arkivAccessKey: "synthetic-public-endpoint-key" });
    vi.mocked(createArkivBriefmintReader).mockReturnValue({ readiness: () => new Promise<boolean>(() => {}) } as unknown as ReturnType<typeof createArkivBriefmintReader>);
    const pending = handleBrief("config", new Request("https://briefmint.invalid/api/briefmint/config"));
    await vi.advanceTimersByTimeAsync(5000);
    expect((await (await pending).json()).data.arkiv.readiness.available).toBe(false);
  });
});
