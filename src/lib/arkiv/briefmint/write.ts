import { createWalletClient, EntityMutationError, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { custom } from "viem";
import { BRIEFMINT_CHAIN_ID, validatePublicationIntent, type BriefmintArkivWriter, type PublicationIntent } from "../../shared/briefs";
import { BriefmintOpportunitySchema, briefmintOpportunityValues } from "./schema";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
/** A receipt wait can fail after a wallet broadcast. Persist this hash before any retry. */
export function arkivBroadcastTransactionHash(error: unknown): string | null {
  return error instanceof EntityMutationError && typeof error.txHash === "string" && /^0x[0-9a-f]{64}$/i.test(error.txHash) ? error.txHash.toLowerCase() : null;
}
export async function writeArkivIntent(intentInput: PublicationIntent, accessKey: string, provider?: Eip1193): Promise<Awaited<ReturnType<BriefmintArkivWriter["write"]>>> {
  if (!provider) throw new Error("A browser wallet is required for Arkiv publication.");
  const intent = await validatePublicationIntent(intentInput); const chain = await provider.request({ method: "eth_chainId" });
  if (BigInt(String(chain)) !== BigInt(BRIEFMINT_CHAIN_ID)) throw new Error("Switch the wallet to Arkiv Rabdi before publishing.");
  const accounts = await provider.request({ method: "eth_accounts" }); const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0].toLowerCase() : null;
  if (!address || address !== intent.ownerAddress.toLowerCase()) throw new Error("The connected wallet must be the approved brief owner.");
  const client = createWalletClient({ account: address as `0x${string}`, chain: rabdi({ accessKey }), transport: custom(provider) }); const values = briefmintOpportunityValues(intent.payload);
  if (intent.operation === "create") { const result = await client.createEntity(BriefmintOpportunitySchema, values, { expiration: ExpirationTime.atBlock(BigInt(intent.expiresAtBlock)), flags: { readonly: false, permissionlessExtension: false } }); return { transactionHash: result.txHash, entityKey: result.entityKey }; }
  const result = await client.patchEntity(BriefmintOpportunitySchema, intent.entityKey as `0x${string}`, { set: values }); return { transactionHash: result.txHash, entityKey: result.entityKey };
}
