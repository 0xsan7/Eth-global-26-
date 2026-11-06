import { describe, expect, it, vi } from "vitest";
import { writeArkivIntent, arkivFailureDiagnostic, arkivBroadcastTransactionHash } from "../../src/lib/arkiv/briefmint/write";
import { hashPublicOpportunity, projectPublicOpportunity, type PublicationIntent } from "../../src/lib/shared/briefs";

// Real installed Arkiv/viem SDKs, isolated EIP-1193 provider. No network/signing.
const owner = `0x${"1".repeat(40)}`;
async function intent(): Promise<PublicationIntent> {
  const payload = projectPublicOpportunity({ parameters: { title: "Offline transaction", summary: "Synthetic public brief", category: "design", language: "en",
    budgetUsdCents: null, deadline: "2026-11-08T00:00:00.000Z", contactUrl: null },
    sections: { deliverables: ["One graphic"], acceptanceCriteria: ["Editable source"], exclusions: [], openQuestions: [] }, status: "open" }, 3);
  return { intentId: `0x${"a".repeat(64)}`, operation: "create", ownerAddress: owner, chainId: 7794095, entityKey: null, basePayloadHash: null,
    payload, publicPayloadHash: await hashPublicOpportunity(payload), expiresAtBlock: "1000", createdAt: "2026-11-07T00:00:00.000Z" };
}

describe("actual Arkiv SDK wallet submission with an offline provider", () => {
  it.each([4001, -32000, -32601, -32602])("forwards only one submission and preserves the first RPC %i error", async code => {
    const provider = { request: vi.fn(async ({ method }: { method: string }): Promise<unknown> => {
      if (method === "eth_chainId") return "0x76edaf";
      if (method === "eth_accounts") return [owner];
      if (method === "eth_blockNumber") return "0x64";
      if (method === "eth_estimateGas") return "0x493e0";
      if (method === "eth_getTransactionCount") return "0x0";
      if (method === "eth_sendTransaction") throw { code, message: "Synthetic provider failure" };
      throw new Error("A second submission or unexpected RPC must never reach this provider");
    }) };
    const broadcast = vi.fn(); let error: unknown;
    try { await writeArkivIntent(await intent(), "", provider, broadcast); } catch (failure) { error = failure; }
    expect(error).toBeDefined();
    expect(arkivFailureDiagnostic(error)).toContain(`RPC ${code}`);
    expect(arkivBroadcastTransactionHash(error)).toBeNull();
    const methods = provider.request.mock.calls.map(([args]) => args.method);
    expect(methods.filter(method => method === "eth_sendTransaction")).toHaveLength(1);
    expect(methods).not.toContain("wallet_sendTransaction");
    expect(broadcast).not.toHaveBeenCalled();
  });
});
