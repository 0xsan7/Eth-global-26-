import { createArkivBriefmintReader } from "../../src/lib/arkiv/briefmint/read";
import { briefIdSchema, opportunityFilterSchema, opportunityRecordSchema, type BriefmintArkivReader } from "../../src/lib/shared/briefs";

const help = "Read-only BriefMint Arkiv reader: --list [--category writing|design] [--status open|closed] [--min-budget-usd-cents N] [--deadline-after UTC_ISO] [--limit 1..50] [--cursor N], or --get 0x<64 hex>. Configure ARKIV_ACCESS_KEY privately, or explicitly add --public-endpoint for the rate-limited public RPC. No API, SQLite, session or wallet is used.";
const valueFlags = ["--get", "--category", "--status", "--min-budget-usd-cents", "--deadline-after", "--limit", "--cursor"];

/** Dependency injection is for deterministic offline tests; no fixture mode exists in the CLI. */
export async function runArkivReader(args: string[], env: NodeJS.ProcessEnv, io: { log(line: string): void; error(line: string): void },
  factory: (config: { accessKey: string }) => Pick<BriefmintArkivReader, "get" | "list"> & { currentBlock?(): Promise<{ number: string }> } = createArkivBriefmintReader,
  now = () => new Date().toISOString(), clock = () => performance.now()): Promise<number> {
  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) { io.log(help); return 0; }
  let phase = "configuration";
  try {
    const options = new Map<string, string>();
    for (let index = 0; index < args.length; index++) {
      const flag = args[index];
      if (options.has(flag) || !["--list", "--public-endpoint", ...valueFlags].includes(flag)) throw new Error();
      if (valueFlags.includes(flag)) {
        const value = args[++index]; if (!value || value.startsWith("--")) throw new Error();
        options.set(flag, value);
      } else options.set(flag, "true");
    }
    if (options.has("--list") === options.has("--get")) throw new Error();
    if (options.has("--get") && [...options.keys()].some(flag => !["--get", "--public-endpoint"].includes(flag))) throw new Error();
    const key = options.has("--get") ? briefIdSchema.parse(options.get("--get")) : null;
    const integer = (flag: string, fallback?: number) => {
      const raw = options.get(flag); if (raw === undefined) return fallback;
      if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error();
      return Number(raw);
    };
    const filter = key ? null : opportunityFilterSchema.parse({ language: "en", status: options.get("--status") ?? "open",
      category: options.get("--category"), deadlineAfter: options.get("--deadline-after") ?? now(),
      minBudgetUsdCents: integer("--min-budget-usd-cents"), limit: integer("--limit", 20), cursor: options.get("--cursor") });
    if (filter?.cursor !== undefined && (!/^(0|[1-9][0-9]*)$/.test(filter.cursor) || !Number.isSafeInteger(Number(filter.cursor)))) throw new Error();
    // Public endpoint mode never reads an environment access key; no other environment names are inspected.
    const accessKey = options.has("--public-endpoint") ? "" : env.ARKIV_ACCESS_KEY;
    if (accessKey === undefined || (!options.has("--public-endpoint") && !accessKey) || accessKey !== accessKey.trim() || /[\r\n]/.test(accessKey)) throw new Error();
    const reader = factory({ accessKey }); phase = "read"; const started = clock();
    if (key) {
      const value = await reader.get(key); const record = value === null ? null : opportunityRecordSchema.parse(value);
      if (record && record.entityKey !== key) throw new Error();
      const block = record || !reader.currentBlock ? null : await reader.currentBlock();
      if (block && !/^(0|[1-9][0-9]*)$/.test(block.number)) throw new Error();
      io.log(JSON.stringify({ status: record ? "found" : "absent", source: "arkiv", audience: "public", latencyMs: Math.max(0, Math.round(clock() - started)), record, blockObservedAfterAbsence: block?.number ?? null }));
    } else {
      const page = await reader.list(filter!); const records = page.records.map(value => opportunityRecordSchema.parse(value));
      if (page.nextCursor !== null && (!/^(0|[1-9][0-9]*)$/.test(page.nextCursor) || !Number.isSafeInteger(Number(page.nextCursor)))) throw new Error();
      io.log(JSON.stringify({ status: records.length ? "found" : "empty", source: "arkiv", audience: "public", latencyMs: Math.max(0, Math.round(clock() - started)), records, nextCursor: page.nextCursor }));
    }
    return 0;
  } catch {
    io.error(JSON.stringify({ status: "failed", phase, code: phase === "configuration" ? "READER_CONFIGURATION_INVALID" : "ARKIV_READ_FAILED" }));
    return phase === "configuration" ? 2 : 1;
  }
}
