import { handle } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  return handle("payment", request, (await context.params).jobId);
}
