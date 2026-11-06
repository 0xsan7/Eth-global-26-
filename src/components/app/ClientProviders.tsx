"use client";
// Browser wallet/query provider boundary - Agent B owned. Imported by the thin
// root layout; also reused by the checkout example.
// Fetches /api/config for public chain RPCs; chain IDs and the official token
// stay hardcoded in wallet-config. No NEXT_PUBLIC_ secrets are read here.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { api } from "@/lib/client/api-client";
import { useSessionAccountSync } from "@/lib/client/use-session";
import { buildWagmiConfig, defaultWagmiConfig } from "@/lib/client/wallet-config";

function AccountSync() {
  useSessionAccountSync();
  return null;
}

export function ClientProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const [rpcs, setRpcs] = useState<{ whitechainRpcUrl?: string; arkivRpcUrl?: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    api
      .config()
      .then((cfg) => {
        if (cancelled) return;
        setRpcs({
          whitechainRpcUrl: cfg.whitechain?.rpcUrl || undefined,
          arkivRpcUrl: cfg.arkiv?.rpcUrl || undefined,
        });
      })
      .catch(() => {
        // Config unavailable: children still render with fallback transports;
        // chain interactions surface their own errors.
        if (!cancelled) setRpcs({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const wagmiConfig = useMemo(
    () => (rpcs ? buildWagmiConfig(rpcs) : defaultWagmiConfig),
    [rpcs],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <AccountSync />
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default ClientProviders;
