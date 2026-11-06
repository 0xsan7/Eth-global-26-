import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Local-only HTTP smoke. Temporary unfunded identity/database; no external calls.
const directory = await mkdtemp(join(tmpdir(), "tool-city-smoke-"));
const base = "http://127.0.0.1:3187";
const origin = "https://tool-city-smoke.invalid";
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: "3187", APP_ORIGIN: origin,
    AUTH_ALLOWED_ORIGINS: origin, SESSION_SECRET: randomBytes(32).toString("hex"),
    DATABASE_PATH: join(directory, "smoke.sqlite"), NEXT_PUBLIC_ENABLE_DEV_FIXTURES: "false",
    ZERO_G_API_KEY: "", ZERO_G_MODEL_ID: "", BRIEFMINT_ALLOWED_WALLETS: "" },
});
let logs = "";
child.stdout.on("data", chunk => { logs += String(chunk); });
child.stderr.on("data", chunk => { logs += String(chunk); });
try {
  let started = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error("Local production process exited before readiness.");
    try { if ((await fetch(base)).ok) { started = true; break; } } catch { /* Wait for local readiness. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(started, "Production server failed to start");
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.equal(config.data.configured, false, "Smoke must use the unconfigured deployment manifest");
  assert.equal((await fetch(`${base}/checkout-demo/index.html`)).status, 200);
  assert.equal((await fetch(`${base}/api/jobs`)).status, 401);
  const account = privateKeyToAccount(generatePrivateKey());
  const challenge = await (await fetch(`${base}/api/auth/challenge?address=${account.address}`)).json();
  assert.equal(challenge.ok, true);
  const signature = await account.signMessage({ message: challenge.data.message });
  const login = await fetch(`${base}/api/auth/verify`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: challenge.data.challengeId, signature }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie);
  const jobs = await fetch(`${base}/api/jobs`, { headers: { Cookie: cookie } });
  assert.equal(jobs.status, 200);
  assert.deepEqual((await jobs.json()).data.jobs, []);
  const blocked = await fetch(`${base}/api/jobs`, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ workshopEntityKey: `0x${"ab".repeat(32)}`, text: "A harmless local smoke sample." }) });
  assert.equal(blocked.status, 503, "Unconfigured checkout must not create a purchasable job");
  const briefConfig = await (await fetch(`${base}/api/briefmint/config`)).json();
  assert.equal(briefConfig.ok, true); assert.equal(briefConfig.data.auth.chainId, 7794095);
  assert.equal(briefConfig.data.compilation.available, false); assert.equal(briefConfig.data.arkiv.readiness.available, false);
  assert.equal((await fetch(`${base}/api/briefs`)).status, 401);
  const briefChallenge = await (await fetch(`${base}/api/auth/challenge?address=${account.address}&purpose=briefmint`)).json();
  assert.match(briefChallenge.data.message, /Chain ID: 7794095/);
  assert.equal((await fetch(`${base}/api/auth/challenge?address=${account.address}&purpose=briefmint&chainId=1874`)).status, 400);
  const headers = { Cookie: cookie, Origin: origin, "Content-Type": "application/json" };
  const created = await fetch(`${base}/api/briefs`, { method: "POST", headers, body: JSON.stringify({
    notes: "Harmless private production smoke notes.",
    publicParameters: { title: "Synthetic public task", summary: "A local smoke sample", category: "writing", language: "en",
      budgetUsdCents: null, deadline: new Date(Date.now() + 86400000).toISOString(), contactUrl: null },
  }) });
  assert.equal(created.status, 201); const brief = (await created.json()).data;
  assert.equal(brief.executionStatus, "draft");
  assert.equal((await fetch(`${base}/api/briefs/${brief.id}`, { headers })).status, 200);
  const list = await (await fetch(`${base}/api/briefs`, { headers })).json();
  assert.equal(list.data.briefs.length, 1); assert(!JSON.stringify(list).includes("private production smoke notes"));
  const run = await fetch(`${base}/api/briefs/${brief.id}/run`, { method: "POST", headers, body: "{}" });
  assert.equal(run.status, 503, "Missing provider/quota must not dispatch");
  const after = await (await fetch(`${base}/api/briefs/${brief.id}`, { headers })).json();
  assert.equal(after.data.attemptsUsed, 0);
  const exported = await fetch(`${base}/api/briefs/${brief.id}/export?format=json`, { headers });
  assert.equal(exported.status, 200); assert.equal(JSON.parse((await exported.json()).data.content).id, brief.id);
  console.log("PASS: standalone assets, legacy auth/jobs/checkout denial, BriefMint chain/readiness, private create/list/get/export, zero-attempt unavailable compilation. No external integration called.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill("SIGTERM");
  await new Promise<void>(resolve => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 2000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
  await rm(directory, { recursive: true, force: true });
}
