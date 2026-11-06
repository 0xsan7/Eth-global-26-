import { handleBrief } from "@/lib/server/brief-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleBrief("config", request); }
