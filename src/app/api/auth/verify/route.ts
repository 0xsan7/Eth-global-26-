import { handle } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return handle("verifyAuth", request); }
