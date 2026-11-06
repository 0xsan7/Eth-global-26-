import { readFile } from "node:fs/promises";
import { getAddress, isAddress, keccak256, toBytes, type Address } from "viem";

export const TOKEN = getAddress("0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7");
// Stable service identifier; hash the exact UTF-8 bytes, without a newline.
export const SERVICE_ID = keccak256(toBytes("tool-city.service.translation.en-hi.v1"));

export function requiredAddress(name: string): Address {
  const value = process.env[name];
  if (!value || !isAddress(value) || /^0x0{40}$/i.test(value)) throw new Error(`${name} must be a nonzero address`);
  return getAddress(value);
}

export async function termsHash() {
  const bytes = await readFile("config/service-terms.txt");
  if (bytes.length === 0) throw new Error("Service terms are empty");
  return keccak256(bytes);
}

export const decimalsAbi = [{ type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }] as const;
