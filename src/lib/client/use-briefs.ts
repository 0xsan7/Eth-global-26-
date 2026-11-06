"use client";
// BriefMint hooks — Agent B owned. Polling follows PRD §10/§16:
// poll GET brief ~2s only while execution is `running` or publication is
// `pending`; terminal/ready/live/closed/expired states use cache + focus.
// `run` fires only from an explicit user action, never on mount or refresh.
// Reconcile retries with backoff on 202; a submitted tx hash alone is never
// treated as confirmed.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { briefmintApi } from "./briefmint-api";
import { queryKeys } from "./api-client";
import type { ExecutionStatus, PrivateBrief, PublicationStatus } from "../shared/briefmint";

export const briefmintQueryKeys = {
  config: ["briefmint-config"] as const,
  briefs: ["briefmint-briefs"] as const,
  brief: (id: string) => ["briefmint-brief", id] as const,
  opportunities: ["briefmint-opportunities"] as const,
};

const ACTIVE_EXECUTION: readonly ExecutionStatus[] = ["running"];
const PENDING_PUBLICATION: readonly PublicationStatus[] = ["pending"];

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

export function useBriefs(authenticated = true) {
  return useQuery({
    queryKey: [...briefmintQueryKeys.briefs],
    queryFn: () => briefmintApi.listBriefs(),
    enabled: authenticated,
    retry: 1,
  });
}

export function useBrief(id: string | null | undefined) {
  return useQuery<PrivateBrief>({
    queryKey: id ? [...briefmintQueryKeys.brief(id)] : ["briefmint-brief", null],
    queryFn: () => briefmintApi.getBrief(id as string),
    enabled: !!id,
    refetchInterval: (query) => {
      const b = query.state.data as PrivateBrief | undefined;
      if (!b) return false;
      if ((ACTIVE_EXECUTION as readonly string[]).includes(b.executionStatus)) return 2000;
      if ((PENDING_PUBLICATION as readonly string[]).includes(b.publication.lastObservedStatus)) return 2000;
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
    mutationFn: (input: { id: string; expectedRevision: number; draft: PrivateBrief["editedDraft"] }) =>
      briefmintApi.saveDraft(input.id, { expectedRevision: input.expectedRevision, draft: input.draft }),
    onSuccess: (brief) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id)], brief);
      void queryClient.invalidateQueries({ queryKey: briefmintQueryKeys.briefs });
    },
  });
}

export function useApproveBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; expectedRevision: number; publicPayloadHash: `0x${string}` }) =>
      briefmintApi.approveBrief(input.id, {
        expectedRevision: input.expectedRevision,
        publicPayloadHash: input.publicPayloadHash,
      }),
    onSuccess: (brief) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id)], brief);
    },
  });
}

export function useReconcilePublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; txHash?: `0x${string}`; entityKey?: `0x${string}` }) => {
      const delaysMs = [1000, 2000, 4000, 8000];
      let result = await briefmintApi.reconcilePublication(input.id, { txHash: input.txHash, entityKey: input.entityKey });
      for (let i = 0; i < delaysMs.length && result.pending; i += 1) {
        await sleep(delaysMs[i]);
        result = await briefmintApi.reconcilePublication(input.id, { txHash: input.txHash, entityKey: input.entityKey });
      }
      return result.brief;
    },
    onSuccess: (brief) => {
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id)], brief);
      void queryClient.invalidateQueries({ queryKey: queryKeys.purchases });
    },
  });
}
