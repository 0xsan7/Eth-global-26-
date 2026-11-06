import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { verifyMessage } from "viem";
import type { Address, Hex } from "../shared/domain";
import { isAddress, normalizeAddress } from "../shared/validation";
import type { Database } from "./db";
import { transaction } from "./db";
import type { ServerEnv } from "./env";
import { badInput, ServiceError, unavailable } from "./errors";
import { BRIEFMINT_CHAIN_ID } from "../shared/briefs";

const COOKIE = "tool_city_session";
export class AuthService {
  constructor(private db: Database, private env: ServerEnv, private now = Date.now) {}
  assertOrigin(request: Request) {
    const origin = request.headers.get("origin");
    if (!origin || !this.env.allowedOrigins.includes(origin)) throw new ServiceError("FORBIDDEN", 403, "Request origin is not allowed.");
  }
  challenge(value: unknown, purpose: unknown = undefined) {
    if (purpose !== undefined && purpose !== "briefmint") throw badInput("Unsupported sign-in purpose.");
    if (typeof value !== "string" || !isAddress(value)) throw badInput("A wallet address is required.");
    const address = normalizeAddress(value);
    const challengeId = randomBytes(24).toString("hex");
    const expires = this.now() + 5 * 60_000;
    const issuedAt = new Date(this.now()).toISOString();
    const expiresAt = new Date(expires).toISOString();
    const statement = purpose === "briefmint" ? "Sign in to BriefMint. This is not a payment or publication authorization." : "Sign in to Tool City. This is not a payment authorization.";
    const chainId = purpose === "briefmint" ? BRIEFMINT_CHAIN_ID : 1874;
    const message = `${new URL(this.env.appOrigin).host} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${this.env.appOrigin}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${challengeId}\nIssued At: ${issuedAt}\nExpiration Time: ${expiresAt}`;
    transaction(this.db, () => {
      this.pruneExpired();
      const outstanding = this.db.prepare("SELECT COUNT(*) AS count FROM auth_challenges WHERE address=? AND consumed_at IS NULL").get(address) as { count: number };
      const total = this.db.prepare("SELECT COUNT(*) AS count FROM auth_challenges").get() as { count: number };
      if (outstanding.count >= 5 || total.count >= 10000) throw unavailable("Too many sign-in challenges. Try again after existing challenges expire.");
      this.db.prepare("INSERT INTO auth_challenges(id,address,message,expires_at) VALUES(?,?,?,?)").run(challengeId, address, message, expires);
    });
    return { challengeId, message, expiresAt };
  }
  async verify(challengeId: unknown, signature: unknown) {
    if (typeof challengeId !== "string" || !/^[a-f0-9]{48}$/.test(challengeId) || typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature) || signature.length > 4096) throw badInput();
    const row = this.db.prepare("SELECT * FROM auth_challenges WHERE id=?").get(challengeId) as { address: Address; message: string; expires_at: number; consumed_at: number | null } | undefined;
    if (!row || row.consumed_at !== null || row.expires_at <= this.now()) throw new ServiceError("UNAUTHENTICATED", 401, "Challenge is invalid or expired.");
    let valid = false;
    try { valid = await verifyMessage({ address: row.address, message: row.message, signature: signature as Hex }); } catch { /* Invalid signatures are authentication failures. */ }
    if (!valid) throw new ServiceError("UNAUTHENTICATED", 401, "Signature is invalid.");
    const token = randomBytes(32).toString("hex");
    const expires = this.now() + 12 * 60 * 60_000;
    transaction(this.db, () => {
      const result = this.db.prepare("UPDATE auth_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>?").run(this.now(), challengeId, this.now());
      if (result.changes !== 1) throw new ServiceError("UNAUTHENTICATED", 401, "Challenge is invalid or expired.");
      this.db.prepare("INSERT INTO auth_sessions VALUES(?,?,?)").run(this.hash(token), row.address, expires);
    });
    return { session: { address: row.address, expiresAt: new Date(expires).toISOString() }, cookie: this.cookie(token, 43200) };
  }
  session(request: Request) {
    this.pruneExpired();
    const token = this.token(request);
    const row = token ? this.db.prepare("SELECT address, expires_at FROM auth_sessions WHERE token_hash=? AND expires_at>?").get(this.hash(token), this.now()) as { address: Address; expires_at: number } | undefined : undefined;
    if (!row) throw new ServiceError("UNAUTHENTICATED", 401, "Sign in to continue.");
    return { address: row.address, expiresAt: new Date(row.expires_at).toISOString() };
  }
  logout(request: Request) {
    const token = this.token(request);
    if (token) this.db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(this.hash(token));
    return this.cookie("", 0);
  }
  private token(request: Request) { return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1); }
  private hash(token: string) { return createHmac("sha256", this.env.sessionSecret).update(token).digest("hex"); }
  private pruneExpired() {
    this.db.prepare("DELETE FROM auth_challenges WHERE expires_at<=?").run(this.now());
    this.db.prepare("DELETE FROM auth_sessions WHERE expires_at<=?").run(this.now());
  }
  private cookie(token: string, age: number) { return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${this.env.secureCookies ? "; Secure" : ""}`; }
}
