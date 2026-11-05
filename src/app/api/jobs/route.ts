import { handle } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handle("listJobs", request); }
export function POST(request: Request) { return handle("createJob", request); }
