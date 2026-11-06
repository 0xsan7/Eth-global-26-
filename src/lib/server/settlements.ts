import "server-only";
import type { Address, MerchantPurchase, PublicConfig } from "../shared/domain";
import { normalizeAddress } from "../shared/validation";
import type { Database } from "./db";
import { ServiceError } from "./errors";

export function listSettlements(db: Database, buyer: Address, config: PublicConfig): MerchantPurchase[] {
  if (!config.terms || normalizeAddress(config.terms.merchantAddress) !== normalizeAddress(buyer)) throw new ServiceError("FORBIDDEN", 403, "Merchant access is required.");
  return (db.prepare("SELECT view_json FROM settlements ORDER BY job_id").all() as { view_json: string }[]).map(row => JSON.parse(row.view_json) as MerchantPurchase);
}
export function settlementCsv(rows: MerchantPurchase[]) {
  const keys: (keyof MerchantPurchase)[] = ["jobId", "buyerAddress", "merchantAddress", "serviceId", "txHash", "blockNumber", "verifiedAt", "chainId", "tokenAddress", "amountAtomic"];
  const cell = (value: unknown) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
  return [keys.map(cell).join(","), ...rows.map(row => keys.map(key => cell(row[key])).join(","))].join("\r\n") + "\r\n";
}
