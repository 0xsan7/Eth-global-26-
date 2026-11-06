import "server-only";
import { isAddress } from "viem";
import type { Database } from "./db";
import { ServiceError, unavailable } from "./errors";

export type QuotaPolicy = {
  allowedWallets: string[]; compilationsPerWallet: number; globalDispatchLimit: number;
  windowId: string; windowEndsAt: number;
};

/** Operator-configured demo policy only. Missing/invalid values disable compilation. */
export function getBriefQuotaPolicy(env: NodeJS.ProcessEnv = process.env): QuotaPolicy | null {
  const wallets = env.BRIEFMINT_ALLOWED_WALLETS?.split(",").map(v => v.trim().toLowerCase()).filter(Boolean) ?? [];
  const compilationsPerWallet = Number(env.BRIEFMINT_COMPILATIONS_PER_WALLET);
  const globalDispatchLimit = Number(env.BRIEFMINT_GLOBAL_DISPATCH_LIMIT);
  const windowId = env.BRIEFMINT_QUOTA_WINDOW_ID;
  const windowEndsAt = Date.parse(env.BRIEFMINT_QUOTA_WINDOW_END ?? "");
  if (!wallets.length || wallets.some(v => !isAddress(v)) || !Number.isSafeInteger(compilationsPerWallet)
    || compilationsPerWallet < 1 || !Number.isSafeInteger(globalDispatchLimit) || globalDispatchLimit < 1
    || !windowId || !/^[a-zA-Z0-9_-]{1,80}$/.test(windowId) || !Number.isFinite(windowEndsAt)) return null;
  return { allowedWallets: [...new Set(wallets)], compilationsPerWallet, globalDispatchLimit, windowId, windowEndsAt };
}

/** Must execute inside the same immediate transaction as the lease claim. Never delete ledger entries. */
export function reserveBriefQuota(db: Database, policy: QuotaPolicy | null, owner: string, briefId: string, attempt: number, now: number) {
  if (!policy || policy.windowEndsAt <= now || !Number.isSafeInteger(policy.globalDispatchLimit) || policy.globalDispatchLimit < 1
    || !Number.isSafeInteger(policy.compilationsPerWallet) || policy.compilationsPerWallet < 1) throw unavailable("Compilation quota is not configured or its window has expired.");
  if (!policy.allowedWallets.some(v => v.toLowerCase() === owner.toLowerCase())) throw new ServiceError("QUOTA_EXHAUSTED", 429, "This wallet is not enabled for promotional compilation.");
  const total = db.prepare("SELECT COUNT(*) AS count FROM brief_quota WHERE window_id=?").get(policy.windowId) as { count: number };
  if (total.count >= policy.globalDispatchLimit) throw new ServiceError("QUOTA_EXHAUSTED", 429, "The promotional dispatch allowance is exhausted.");
  if (attempt === 1) {
    const used = db.prepare("SELECT COUNT(DISTINCT brief_id) AS count FROM brief_quota WHERE window_id=? AND lower(owner)=lower(?) AND attempt=1").get(policy.windowId, owner) as { count: number };
    if (used.count >= policy.compilationsPerWallet) throw new ServiceError("QUOTA_EXHAUSTED", 429, "This wallet's compilation allowance is exhausted.");
  }
  db.prepare("INSERT INTO brief_quota(owner,brief_id,attempt,window_id,dispatched_at) VALUES(?,?,?,?,?)").run(owner, briefId, attempt, policy.windowId, now);
}
