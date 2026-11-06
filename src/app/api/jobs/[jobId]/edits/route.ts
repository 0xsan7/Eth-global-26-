import { handle } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  return handle("edits", request, (await context.params).jobId);
}
