import { handle } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  return handle("run", request, (await context.params).jobId);
}
