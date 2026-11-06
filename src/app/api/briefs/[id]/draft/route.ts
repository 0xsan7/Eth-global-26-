import { handleBrief } from "@/lib/server/brief-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleBrief("saveDraft", request, (await context.params).id);
}
