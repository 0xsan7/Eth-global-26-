import { afterEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { AuthService } from "../../src/lib/server/auth";
import { openDatabase, type Database } from "../../src/lib/server/db";
import type { ServerEnv } from "../../src/lib/server/env";

const wallet = privateKeyToAccount(`0x${"01".repeat(32)}`);
const env: ServerEnv = { appOrigin: "https://old.example", allowedOrigins: ["https://old.example"],
  sessionSecret: "synthetic-test-secret-".repeat(3), databasePath: ":memory:", rpcUrl: undefined,
  inferenceKey: undefined, inferenceBaseUrl: "https://provider.invalid", modelId: undefined,
  inferenceTimeoutMs: 1000, paymentConfirmations: 3, secureCookies: true };
const opened: Database[] = [];
function database() { const db = openDatabase(":memory:"); opened.push(db); return db; }
afterEach(() => { for (const db of opened.splice(0)) db.close(); });

describe("wallet challenge security", () => {
  it.each([undefined, "briefmint"])("rejects a persisted %s challenge at a changed origin without consuming it", async purpose => {
    const db = database(); const original = new AuthService(db, env);
    const challenge = original.challenge(wallet.address, purpose);
    const signature = await wallet.signMessage({ message: challenge.message });
    for (const appOrigin of ["https://new.example", "http://old.example"]) {
      const changed = new AuthService(db, { ...env, appOrigin });
      await expect(changed.verify(challenge.challengeId, signature)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    }
    const result = await original.verify(challenge.challengeId, signature);
    expect(result.session.address.toLowerCase()).toBe(wallet.address.toLowerCase());
    expect(result.cookie).toContain("; HttpOnly; SameSite=Lax;");
    expect(result.cookie).toContain("; Secure");
  });

  it("issues distinct nonces and consumes a challenge exactly once under concurrent verification", async () => {
    const db = database(); const auth = new AuthService(db, env);
    const first = auth.challenge(wallet.address, "briefmint");
    const second = auth.challenge(wallet.address, "briefmint");
    expect(first.challengeId).not.toBe(second.challengeId);
    const signature = await wallet.signMessage({ message: first.message });
    const results = await Promise.allSettled([auth.verify(first.challengeId, signature), auth.verify(first.challengeId, signature)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get()).toMatchObject({ count: 1 });
  });
});
