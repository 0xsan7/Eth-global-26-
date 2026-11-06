import { handle } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handle("challenge", request); }
