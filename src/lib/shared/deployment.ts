import manifest from "../../../config/deployment.json";
import { keccak256, stringToHex } from "viem";
import { z } from "zod";
import type { PublicConfig } from "./domain";
import { isAddress } from "./validation";

const address = z.string().refine(isAddress, "Invalid public address");
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const termsSchema = z.object({
  chainId: z.literal(1874), checkoutAddress: address, tokenAddress: address,
  tokenDecimals: z.number().int().min(0).max(77), amountAtomic: z.string().regex(/^[1-9][0-9]{0,77}$/),
  merchantAddress: address, serviceId: hash, termsHash: hash,
}).strict();
const configSchema = z.object({
  schemaVersion: z.literal(1), configured: z.boolean(), appNamespace: z.literal("tool-city.workshop.v1"),
  sourceLang: z.literal("en"), targetLang: z.literal("hi"), maxWords: z.literal(250), maxChars: z.literal(5000),
  arkiv: z.object({ chainId: z.literal(7794095), rpcUrl: z.url(), explorerUrl: z.url() }).strict(),
  whitechain: z.object({ chainId: z.literal(1874), rpcUrl: z.url(), explorerUrl: z.url(), tokenAddress: address }).strict(),
  terms: termsSchema.nullable(), serviceTermsText: z.string().min(1),
}).strict();

export function validatePublicConfig(value: unknown): PublicConfig {
  const config = configSchema.parse(value);
  const officialToken = "0xcedfb56113143d55b2358b8cfbb0deb5ad2f55a7";
  if (config.whitechain.tokenAddress.toLowerCase() !== officialToken) throw new Error("Official token configuration is required.");
  if (config.configured && !config.terms) throw new Error("Configured checkout must include accepted terms.");
  if (config.terms) {
    const t = config.terms;
    if (t.tokenAddress.toLowerCase() !== officialToken || BigInt(t.amountAtomic) !== 10n ** BigInt(t.tokenDecimals)) throw new Error("Checkout must use the fixed official test-token price.");
    if (t.termsHash.toLowerCase() !== keccak256(stringToHex(config.serviceTermsText))) throw new Error("Displayed service terms do not match their committed hash.");
  }
  return config as PublicConfig;
}

// Client-safe public data only. Financial authorization still requires chain reads.
export function getPublicConfig(): PublicConfig {
  return validatePublicConfig(structuredClone(manifest));
}

// Browser-safe access to public network metadata for wallet fallbacks.
export function getDeploymentManifest(): typeof manifest {
  return manifest;
}
