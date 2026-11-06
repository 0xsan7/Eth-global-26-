// BriefMint Arkiv lifecycle probe — read-only, no wallet, no private key.
// Queries the legacy workshop namespace and the new opportunity namespace
// through the public Rabdi RPC and reports counts. Writes are NEVER attempted
// here: publication requires the project-owner wallet signature in the browser.
// Run: npx tsx scripts/probe-briefmint-arkiv.ts [--rpc URL]
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { http } from "viem";
import { WORKSHOP_SCHEMA } from "../src/lib/arkiv/schema";
import { OPPORTUNITY_SCHEMA } from "../src/lib/arkiv/opportunity-schema";

const DEFAULT_RPC = "https://rpc.rabdi.db-chain.testnet.arkiv.network";

async function count(schema: unknown, rpcUrl: string, label: string) {
  const client = createPublicClient({ chain: rabdi({ accessKey: "" }), transport: http(rpcUrl) });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (client.select() as any).from(schema).limit(5).fetch();
    const n = Array.isArray(page?.entities) ? page.entities.length : 0;
    console.log(`${label}: query ok, first page entities=${n}`);
    return { label, ok: true as const, firstPage: n };
  } catch (e) {
    console.log(`${label}: query FAILED — ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`);
    return { label, ok: false as const, error: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300) };
  }
}

async function main() {
  const flag = process.argv.indexOf("--rpc");
  const rpcUrl = flag >= 0 && process.argv[flag + 1] ? process.argv[flag + 1] : DEFAULT_RPC;
  console.log(`briefmint-arkiv-probe rpc=${rpcUrl}`);
  void eq;
  const results = [
    await count(WORKSHOP_SCHEMA, rpcUrl, "legacy workshop namespace (tool-city.workshop.v1)"),
    await count(OPPORTUNITY_SCHEMA, rpcUrl, "briefmint opportunity namespace (tool-city.opportunity.v1)"),
  ];
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? "probe: all reads ok (no writes attempted)" : `probe: ${failed.length} read(s) failed (no writes attempted)`);
  if (failed.length > 0) process.exitCode = 1;
}

void main();
