"use client";
// Wallet + session controls — Agent B owned. Connect the project-owner wallet,
// switch between Rabdi (Arkiv publication) and Whitechain (legacy checkout),
// sign in/out of the cookie session, and wrong-network hints. The wallet's
// private key is never requested or handled — signing happens in the wallet.
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useLogin, useLogout, useSession } from "@/lib/client/use-session";
import {
  ARKIV_RABDI_ID,
  WHITECHAIN_ID,
  arkivChain,
  whitechain,
} from "@/lib/client/wallet-config";

export function truncateAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** Presentation-only friendly names for wallet connectors. No logic depends on these. */
function connectorLabel(name: string): string {
  if (/injected/i.test(name)) return "Browser wallet";
  return name;
}

function chainLabel(chainId: number | undefined): string {
  if (chainId === WHITECHAIN_ID) return whitechain.name;
  if (chainId === ARKIV_RABDI_ID) return arkivChain.name;
  return chainId === undefined ? "Not connected" : `Chain ${chainId}`;
}

export default function WalletControls({
  expectedChainId = ARKIV_RABDI_ID,
}: {
  /** Network the surrounding screen expects; defaults to Rabdi (Arkiv publication). */
  expectedChainId?: number;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    switchChain,
    isPending: isSwitching,
    error: switchError,
  } = useSwitchChain();
  const session = useSession();
  const login = useLogin();
  const logout = useLogout();

  const sessionAddress = session.address;
  const wrongNetwork = isConnected && chainId !== expectedChainId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
      {!isConnected ? (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              disabled={isConnecting}
              onClick={() => connect({ connector })}
              title={connectors.length > 1 ? connectorLabel(connector.name) : "Connect your wallet to start"}
            >
              {isConnecting ? "Connecting…" : connectors.length > 1 ? `Connect wallet (${connectorLabel(connector.name)})` : "Connect wallet"}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span title={address}>
            Wallet: {address ? truncateAddress(address) : "—"} ({chainLabel(chainId)})
          </span>
          <button
            type="button"
            disabled={isSwitching || chainId === WHITECHAIN_ID}
            onClick={() => switchChain({ chainId: WHITECHAIN_ID })}
            title="Whitechain network (legacy checkout)"
          >
            {whitechain.name}
          </button>
          <button
            type="button"
            disabled={isSwitching || chainId === ARKIV_RABDI_ID}
            onClick={() => switchChain({ chainId: ARKIV_RABDI_ID })}
            title="Arkiv Rabdi network (opportunity publication)"
          >
            {arkivChain.name}
          </button>
          <button type="button" onClick={() => disconnect()}>
            Disconnect
          </button>
        </div>
      )}

      {wrongNetwork && (
        <p role="status" style={{ margin: 0 }}>
          Wrong network: this screen expects {chainLabel(expectedChainId)}.{" "}
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: expectedChainId })}
          >
            {isSwitching ? "Switching…" : `Switch to ${chainLabel(expectedChainId)}`}
          </button>
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        {session.loading ? (
          <span>Checking session…</span>
        ) : sessionAddress ? (
          <>
            <span title={sessionAddress}>Logged in: {truncateAddress(sessionAddress)}</span>
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              {logout.isPending ? "Logging out…" : "Log out"}
            </button>
          </>
        ) : isConnected && address ? (
          <>
            <button
              type="button"
              disabled={login.isPending}
              onClick={() => login.mutate(address)}
              title="Sign a login challenge (not a payment authorization)"
            >
              {login.isPending ? "Signing…" : "Log in with wallet"}
            </button>
            {login.isError && <span role="alert">Login failed — signature declined or expired.</span>}
          </>
        ) : (
          <span>Connect a wallet, then log in.</span>
        )}
      </div>

      {connectError && <p role="alert" style={{ margin: 0 }}>{connectError.message}</p>}
      {switchError && <p role="alert" style={{ margin: 0 }}>{switchError.message}</p>}
      {logout.isError && (
        <p role="alert" style={{ margin: 0 }}>
          Logout did not reach the server, but local private state was cleared.
        </p>
      )}
    </div>
  );
}
