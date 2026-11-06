import "server-only";
import { getPublicConfig } from "../shared/deployment";
import { getServerEnv } from "./env";
import { openDatabase } from "./db";
import { AuthService } from "./auth";
import { JobService } from "./jobs";
import { createPaymentVerifier, PaymentService, reconcileCheckoutTerms } from "./payment";
import { createInferenceProvider } from "./inference";
import { Runner } from "./recovery";
import { createBriefRuntime } from "./brief-runtime";

function createRuntime() {
  const env = getServerEnv();
  const db = openDatabase(env.databasePath);
  const config = getPublicConfig();
  return { env, db, config, auth: new AuthService(db, env), jobs: new JobService(db, config, undefined, Date.now, terms => reconcileCheckoutTerms(env.rpcUrl, terms)), payment: new PaymentService(db, createPaymentVerifier(env.rpcUrl, env.paymentConfirmations)), runner: new Runner(db, createInferenceProvider(env), env.inferenceTimeoutMs), briefmint: createBriefRuntime(db, env) };
}
let runtime: ReturnType<typeof createRuntime> | undefined;
export function getRuntime() { return runtime ??= createRuntime(); }
