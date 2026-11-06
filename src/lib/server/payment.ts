import "server-only";
import { createPublicClient, decodeEventLog, erc20Abi, http, parseAbi, TransactionReceiptNotFoundError, type PublicClient } from "viem";
import type { Address, CheckoutTerms, Hex, JobView, MerchantPurchase, PaymentView } from "../shared/domain";
import { checkoutAbi } from "../shared/checkout-abi";
import { isHex32, normalizeAddress } from "../shared/validation";
import { ownedJob, saveJob } from "./jobs";
import type { Database } from "./db";
import { transaction } from "./db";
import { badInput, ServiceError, unavailable } from "./errors";

export type PaymentCheck = { pending: true } | { pending: false; blockNumber: string };
export type PaymentVerifier = (job: JobView, txHash: Hex) => Promise<PaymentCheck>;
const transferAbi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const mismatch = () => new ServiceError("PAYMENT_MISMATCH", 409, "Transaction does not match this purchase.");

export async function reconcileCheckoutTerms(rpcUrl: string | undefined, terms: CheckoutTerms) {
  if (!rpcUrl) throw unavailable("Whitechain RPC is not configured.");
  try {
    const client = createPublicClient({ transport: http(rpcUrl, { timeout: 12000, retryCount: 0 }) });
    if (terms.chainId !== 1874 || !same(terms.tokenAddress, "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7") || await client.getChainId() !== terms.chainId) throw unavailable("Checkout network or official token does not match.");
    const read = (functionName: "token" | "merchant" | "serviceId" | "amount" | "termsHash") => client.readContract({ address: terms.checkoutAddress, abi: checkoutAbi, functionName });
    const [token, merchant, serviceId, amount, termsHash, decimals] = await Promise.all([read("token"), read("merchant"), read("serviceId"), read("amount"), read("termsHash"), client.readContract({ address: terms.tokenAddress, abi: erc20Abi, functionName: "decimals" })]);
    if (!same(String(token), terms.tokenAddress) || !same(String(merchant), terms.merchantAddress) || !same(String(serviceId), terms.serviceId) || String(amount) !== terms.amountAtomic || !same(String(termsHash), terms.termsHash) || Number(decimals) !== terms.tokenDecimals) throw unavailable("Checkout contract does not match configuration.");
  } catch (error) { if (error instanceof ServiceError) throw error; throw unavailable("Checkout contract could not be reconciled."); }
}

export function createPaymentVerifier(rpcUrl: string | undefined, confirmations: number): PaymentVerifier {
  return async (job, txHash) => {
    if (!rpcUrl) throw unavailable("Whitechain RPC is not configured.");
    const client = createPublicClient({ transport: http(rpcUrl, { timeout: 12000, retryCount: 0 }) }) as PublicClient;
    return verifyOnchain(client, job, txHash, confirmations);
  };
}
export async function verifyOnchain(client: PublicClient, job: JobView, txHash: Hex, confirmations: number): Promise<PaymentCheck> {
  const t = job.terms;
  if (await client.getChainId() !== t.chainId) throw unavailable("RPC network does not match checkout.");
  let receipt;
  try { receipt = await client.getTransactionReceipt({ hash: txHash }); }
  catch (error) { if (error instanceof TransactionReceiptNotFoundError) return { pending: true }; throw unavailable("Payment receipt could not be checked."); }
  if (receipt.status !== "success" || !receipt.to || !same(receipt.to, t.checkoutAddress) || !same(receipt.from, job.buyerAddress)) throw mismatch();
  if ((await client.getBlockNumber()) - receipt.blockNumber + 1n < BigInt(confirmations)) return { pending: true };
  const read = (functionName: "token" | "merchant" | "serviceId" | "amount" | "termsHash") => client.readContract({ address: t.checkoutAddress, abi: checkoutAbi, functionName, blockNumber: receipt.blockNumber });
  const [token, merchant, service, amount, terms, decimals, purchase] = await Promise.all([
    read("token"), read("merchant"), read("serviceId"), read("amount"), read("termsHash"),
    client.readContract({ address: t.tokenAddress, abi: erc20Abi, functionName: "decimals", blockNumber: receipt.blockNumber }),
    client.readContract({ address: t.checkoutAddress, abi: checkoutAbi, functionName: "getPurchase", args: [job.buyerAddress, job.id], blockNumber: receipt.blockNumber })
  ]);
  const p = purchase as { buyer: Address; serviceId: Hex; merchant: Address; amount: bigint; termsHash: Hex };
  if (!same(String(token), t.tokenAddress) || !same(String(merchant), t.merchantAddress) || !same(String(service), t.serviceId) || String(amount) !== t.amountAtomic || !same(String(terms), t.termsHash) || Number(decimals) !== t.tokenDecimals || !p || !same(p.buyer, job.buyerAddress) || !same(p.serviceId, t.serviceId) || !same(p.merchant, t.merchantAddress) || String(p.amount) !== t.amountAtomic || !same(p.termsHash, t.termsHash)) throw mismatch();
  let purchaseEvents = 0;
  let transferFound = false;
  for (const log of receipt.logs) {
    if (same(log.address, t.checkoutAddress)) {
      try {
        const event = decodeEventLog({ abi: checkoutAbi, eventName: "PurchaseMade", data: log.data, topics: log.topics });
        const a = event.args as unknown as { buyer: string; jobId: string; serviceId: string; merchant: string; amount: bigint; termsHash: string };
        if (same(a.buyer, job.buyerAddress) && same(a.jobId, job.id) && same(a.serviceId, t.serviceId) && same(a.merchant, t.merchantAddress) && a.amount.toString() === t.amountAtomic && same(a.termsHash, t.termsHash)) purchaseEvents++;
      } catch { /* Ignore other contract event signatures. */ }
    }
    if (same(log.address, t.tokenAddress)) {
      try {
        const { args } = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics });
        if (same(args.from, job.buyerAddress) && same(args.to, t.merchantAddress) && args.value.toString() === t.amountAtomic) transferFound = true;
      } catch { /* Ignore non-Transfer token events. */ }
    }
  }
  if (purchaseEvents !== 1 || !transferFound) throw mismatch();
  return { pending: false, blockNumber: receipt.blockNumber.toString() };
}
export class PaymentService {
  constructor(private db: Database, private verifier: PaymentVerifier, private now = Date.now) {}
  async verify(buyer: Address, id: string, value: unknown) {
    if (typeof value !== "string" || !isHex32(value)) throw badInput("A transaction hash is required.");
    const job = ownedJob(this.db, id, buyer);
    if (job.payment?.status === "verified") return { job, pending: false };
    let checked: PaymentCheck;
    try { checked = await this.verifier(job, value as Hex); }
    catch (error) { if (error instanceof ServiceError) throw error; throw unavailable("Payment could not be checked."); }
    return transaction(this.db, () => {
      const current = ownedJob(this.db, id, buyer);
      if (current.payment?.status === "verified") return { job: current, pending: false };
      const timestamp = new Date(this.now()).toISOString();
      const payment: PaymentView = { txHash: value as Hex, status: checked.pending ? "submitted" : "verified", blockNumber: checked.pending ? null : checked.blockNumber, verifiedAt: checked.pending ? null : timestamp };
      current.payment = payment; current.status = checked.pending ? "payment_pending" : "paid"; current.updatedAt = timestamp;
      saveJob(this.db, current);
      if (!checked.pending) {
        const t = current.terms;
        const settlement: MerchantPurchase = { jobId: current.id, buyerAddress: normalizeAddress(buyer), merchantAddress: t.merchantAddress, serviceId: t.serviceId, txHash: value as Hex, blockNumber: checked.blockNumber, verifiedAt: timestamp, chainId: t.chainId, tokenAddress: t.tokenAddress, amountAtomic: t.amountAtomic };
        this.db.prepare("INSERT INTO settlements(job_id,buyer,view_json) VALUES(?,?,?)").run(id, normalizeAddress(buyer), JSON.stringify(settlement));
      }
      return { job: current, pending: checked.pending };
    });
  }
}
