"use client";
// Session hooks: cookie session + wallet-signed login — Agent B owned.
// Flow: connect wallet -> GET challenge -> signMessage -> POST verify -> session
// cookie. Switching accounts clears the previous buyer's private caches and ends
// the old session; switching networks alone never logs out (see use-session
// account sync, which only reacts to address changes).
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { api, isApiError, queryKeys } from "./api-client";
import type { SessionResponse } from "../shared/api";

export function useSession() {
  const query = useQuery<SessionResponse | null>({
    queryKey: [...queryKeys.session],
    queryFn: async () => {
      try {
        return await api.session();
      } catch (e) {
        // Unauthenticated is a normal logged-out state, not a query error.
        if (isApiError(e) && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
  return {
    /** Authenticated buyer address, or null when logged out. */
    address: query.data?.address ?? null,
    expiresAt: query.data?.expiresAt ?? null,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  return useMutation({
    mutationFn: async (address: string) => {
      const challenge = await api.challenge(address);
      const signature = await signMessageAsync({ message: challenge.message });
      return api.verify(challenge.challengeId, signature);
    },
    onSuccess: (data) => {
      queryClient.setQueryData([...queryKeys.session], data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        return await api.logout();
      } catch {
        // Logout is best-effort: local state is cleared regardless.
        return { loggedOut: true as const };
      }
    },
    onSettled: () => {
      queryClient.setQueryData([...queryKeys.session], null);
      queryClient.removeQueries({ queryKey: queryKeys.jobs });
      queryClient.removeQueries({ queryKey: ["job"] });
      queryClient.removeQueries({ queryKey: queryKeys.purchases });
    },
  });
}

function clearPrivateCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.setQueryData([...queryKeys.session], null);
  queryClient.removeQueries({ queryKey: queryKeys.jobs });
  queryClient.removeQueries({ queryKey: ["job"] });
  queryClient.removeQueries({ queryKey: queryKeys.purchases });
}

/**
 * Mount once inside the wallet provider (see ClientProviders). On wallet
 * account change — including disconnect — drop the previous buyer's private
 * UI/query caches and end the old server session. Network switches alone do
 * not trigger this hook (it watches `address` only).
 */
export function useSessionAccountSync() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const prevAddress = useRef<string | undefined>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      prevAddress.current = address;
      return;
    }
    if (prevAddress.current !== address) {
      prevAddress.current = address;
      clearPrivateCaches(queryClient);
      // Fire-and-forget: cookie clearing must not block the UI.
      api.logout().catch(() => {});
    }
  }, [address, queryClient]);
}
