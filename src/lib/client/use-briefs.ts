"use client";
// BriefMint hooks — Agent B owned. Polling follows the canonical state model:
// poll GET brief ~2s only while execution is `running` or publication status
// is `pending`; terminal/live/closed/expired states use cache + focus.
// `run` fires only from an explicit user action, never on mount or refresh.
// Reconcile retries with backoff on 202; a submitted tx hash alone is never
// treated as confirmed.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { briefmintApi } from "./briefmint-api";
import type { BriefApiRequest, BriefView } from "../shared/briefmint";

export const briefmintQueryKeys = {
  config: ["briefmint-config"] as const,
  briefs: ["briefmint-briefs"] as const,
  brief: (id: string) => ["briefmint-brief", id] as const,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useBriefMintConfig() {
  return useQuery({
    queryKey: [...briefmintQueryKeys.config],
    queryFn: () => briefmintApi.config(),
    retry: 1,
    staleTime: 30_000,
  });
}

export function useBriefs(authenticated = true, beforeId?: string) {
  return useQuery({
    queryKey: [...briefmintQueryKeys.briefs, beforeId ?? null],
    queryFn: () => briefmintApi.listBriefs(beforeId),
    enabled: authenticated,
    retry: 1,
  });
}

export function useBrief(id: string | null | undefined) {
  return useQuery<BriefView>({
    queryKey: id ? [...briefmintQueryKeys.brief(id)] : ["briefmint-brief", null],
    queryFn: () => briefmintApi.getBrief(id as string),
    enabled: !!id,
    refetchInterval: (query) => {
      const b = query.state.data as BriefView | undefined;
      if (!b) return false;
      if (b.executionStatus === "running" || b.publication.status === "pending") return 2000;
      return false;
    },
    retry: 1,
  });
}

export function useCreateBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: briefmintApi.createBrief,
    onSuccess: (brief) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id)], brief);
      void queryClient.invalidateQueries({ queryKey: briefmintQueryKeys.briefs });
    },
  });
}

export function useRunBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => briefmintApi.runBrief(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(id)], result.brief);
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; req: BriefApiRequest<"saveDraft"> }) =>
      briefmintApi.saveDraft(input.id, input.req),
    onSuccess: (brief) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id)], brief);
      void queryClient.invalidateQueries({ queryKey: briefmintQueryKeys.briefs });
    },
  });
}

export function useApproveBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; req: BriefApiRequest<"approve"> }) =>
      briefmintApi.approveBrief(input.id, input.req),
    onSuccess: (brief) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id)], brief);
    },
  });
}

export function usePreparePublication() {
  return useMutation({
    mutationFn: (input: { id: string; req: BriefApiRequest<"prepare"> }) =>
      briefmintApi.preparePublication(input.id, input.req),
  });
}

export function useReconcilePublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; req: BriefApiRequest<"reconcile"> }) => {
      const delaysMs = [1000, 2000, 4000, 8000];
      let result = await briefmintApi.reconcilePublication(input.id, input.req);
      for (let i = 0; i < delaysMs.length && result.pending; i += 1) {
        await sleep(delaysMs[i]);
        result = await briefmintApi.reconcilePublication(input.id, input.req);
      }
      return result.brief;
    },
    onSuccess: (brief) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id)], brief);
    },
  });
}

export function useRefreshPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => briefmintApi.refreshPublication(id),
    onSuccess: (brief) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id)], brief);
    },
  });
}
