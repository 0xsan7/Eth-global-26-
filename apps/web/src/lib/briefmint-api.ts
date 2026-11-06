import {
  briefApi,
  type BriefApiName,
  type BriefApiRequest,
  type BriefApiResponse,
} from "@briefmint/shared";

type ApiSuccess<K extends BriefApiName> = Extract<BriefApiResponse<K>, { ok: true }>;

export class BriefmintApiError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, message: string) {
    super(message);
  }
}

function endpointUrl<K extends BriefApiName>(name: K, id?: string, query?: Record<string, string | undefined>) {
  const endpoint = briefApi[name];
  const path = endpoint.path.replace(":id", id ?? "");
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

/** Browser-only typed API client. Every response is checked against the frozen DTO registry. */
export async function briefApiCall<K extends BriefApiName>(
  name: K,
  input: BriefApiRequest<K>,
  options: { id?: string; query?: Record<string, string | undefined> } = {},
): Promise<ApiSuccess<K>["data"]> {
  const endpoint = briefApi[name];
  const response = await fetch(endpointUrl(name, options.id, options.query), {
    method: endpoint.method,
    credentials: "same-origin",
    headers: endpoint.method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: endpoint.method === "GET" ? undefined : JSON.stringify(input),
  });
  let json: unknown;
  try { json = await response.json(); } catch { throw new BriefmintApiError("BAD_RESPONSE", false, "BriefMint returned an unreadable response."); }
  const parsed = endpoint.response.safeParse(json);
  if (!parsed.success) throw new BriefmintApiError("BAD_RESPONSE", false, "BriefMint returned an invalid response.");
  if (!parsed.data.ok) throw new BriefmintApiError(parsed.data.error.code, parsed.data.error.retryable, parsed.data.error.message);
  return parsed.data.data as ApiSuccess<K>["data"];
}

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
};
declare global { interface Window { ethereum?: EthereumProvider } }

/** Wallet sign-in only. It requests no transaction, allowance, payment or Arkiv write. */
export async function connectBriefmintWallet(): Promise<string> {
  const provider = window.ethereum;
  if (!provider) throw new BriefmintApiError("WALLET_UNAVAILABLE", false, "Install or unlock an EVM browser wallet first.");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
  if (!address) throw new BriefmintApiError("WALLET_UNAVAILABLE", false, "No wallet account was selected.");
  const rawChain = await provider.request({ method: "eth_chainId" });
  try { if (BigInt(String(rawChain)) !== 7794095n) throw new Error(); }
  catch { throw new BriefmintApiError("WRONG_CHAIN", false, "Switch the wallet to Arkiv Rabdi (chain 7794095), then sign in again."); }
  const challenge = await briefApiCall("config", {});
  if (challenge.auth.chainId !== 7794095) throw new BriefmintApiError("CHAIN_POLICY", false, "BriefMint is not configured for the Arkiv chain.");
  const request = await fetch(`/api/auth/challenge?address=${encodeURIComponent(address)}&purpose=briefmint`, { credentials: "same-origin" });
  const challengeJson = await request.json() as { ok?: boolean; data?: { challengeId?: string; message?: string } };
  if (!request.ok || !challengeJson.ok || !challengeJson.data?.challengeId || !challengeJson.data.message) {
    throw new BriefmintApiError("AUTH_UNAVAILABLE", false, "BriefMint could not create a sign-in challenge.");
  }
  const signature = await provider.request({ method: "personal_sign", params: [challengeJson.data.message, address] });
  const verified = await fetch("/api/auth/verify", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId: challengeJson.data.challengeId, signature }) });
  if (!verified.ok) throw new BriefmintApiError("AUTH_FAILED", false, "Wallet sign-in was not accepted.");
  return address.toLowerCase();
}

export async function logoutBriefmintWallet() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
}
