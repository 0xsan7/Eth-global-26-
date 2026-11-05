import "server-only";
import { ValidationError, parseJobId } from "../shared/validation";
import type { ApiResult } from "../shared/api";
import { badInput, ServiceError } from "./errors";
import { getRuntime } from "./runtime";
import { reconcileExpiredLeases } from "./recovery";
import { listSettlements, settlementCsv } from "./settlements";
import { getPublicConfig } from "../shared/deployment";
import { reconcileCheckoutTerms } from "./payment";
import { readBoundedText } from "./bounded-body";

function json<T>(data: T, status = 200, headers?: HeadersInit) { return Response.json({ ok: true, data } satisfies ApiResult<T>, { status, headers: { "Cache-Control": "no-store", ...headers } }); }
async function body(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw badInput("JSON content type is required.");
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 32_000)) { await request.body?.cancel(); throw badInput("Request body is invalid or too large."); }
  let text: string;
  try { text = await readBoundedText(request.body, 32_000); } catch { throw badInput("Request body is invalid or too large."); }
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw badInput(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badInput();
  return value as Record<string, unknown>;
}
export type Action = "config" | "challenge" | "verifyAuth" | "session" | "logout" | "createJob" | "listJobs" | "job" | "payment" | "run" | "edits" | "purchases" | "csv";
export async function handle(action: Action, request: Request, id?: string): Promise<Response> {
  try {
    if (action === "config") {
      const config = getPublicConfig();
      if (config.configured && config.terms) {
        try { await reconcileCheckoutTerms(process.env.WHITECHAIN_RPC_URL, config.terms); }
        catch { config.configured = false; config.terms = null; }
      }
      return json(config);
    }
    const runtime = getRuntime();
    const { auth, jobs, db, config } = runtime;
    if (request.method !== "GET") auth.assertOrigin(request);
    if (action === "challenge") return json(auth.challenge(new URL(request.url).searchParams.get("address")));
    if (action === "verifyAuth") { const data = await body(request); const result = await auth.verify(data.challengeId, data.signature); return json(result.session, 200, { "Set-Cookie": result.cookie }); }
    if (action === "session") return json(auth.session(request));
    if (action === "logout") { await body(request); return json({ loggedOut: true }, 200, { "Set-Cookie": auth.logout(request) }); }
    const { address } = auth.session(request);
    if (action === "createJob") { const data = await body(request); return json(await jobs.create(address, data.workshopEntityKey, data.text), 201); }
    if (action === "listJobs") { reconcileExpiredLeases(db); return json({ jobs: jobs.list(address) }); }
    if (action === "purchases" || action === "csv") {
      const purchases = listSettlements(db, address, config);
      return action === "purchases" ? json({ purchases }) : new Response(settlementCsv(purchases), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="tool-city-app-settlements.csv"', "Cache-Control": "no-store" } });
    }
    const jobId = parseJobId(id);
    if (action === "job") { reconcileExpiredLeases(db); return json(jobs.get(address, jobId)); }
    if (action === "payment") { const data = await body(request); const result = await runtime.payment.verify(address, jobId, data.txHash); return json(result.job, result.pending ? 202 : 200); }
    if (action === "run") { await body(request); const result = await runtime.runner.run(address, jobId); return json(result.job, result.running ? 202 : 200); }
    if (action === "edits") { const data = await body(request); return json(jobs.edits(address, jobId, data.segments)); }
    throw badInput();
  } catch (error) {
    const failure = error instanceof ServiceError ? error : error instanceof ValidationError ? badInput(error.message) : new ServiceError("INTERNAL_ERROR", 500, "Request could not be completed.");
    return Response.json({ ok: false, error: { code: failure.code, message: failure.message, retryable: failure.retryable } } satisfies ApiResult<never>, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
