"use client";
// Owner publication: prepare the approved payload from the backend, sign the
// Arkiv write with the connected project-owner wallet, then reconcile the
// confirmed entity with the backend. A submitted transaction alone is never
// treated as success — `pending` stays until the server confirms owner,
// payload, revision, and expiry. Never requests a private key.
import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Transport } from "viem";
import { isApiError } from "@/lib/client/briefmint-api";
import { briefmintApi } from "@/lib/client/briefmint-api";
import { useReconcilePublication } from "@/lib/client/use-briefs";
import type { Hex, PrivateBrief } from "@/lib/shared/briefmint";
import { isApprovalCurrent } from "@/lib/shared/briefmint-validation";
import { closeOpportunity, createOpportunity, updateOpportunity } from "@/lib/arkiv/opportunities-write";

interface OpportunityPublisherProps {
  brief: PrivateBrief | null;
  onSaved: (b: PrivateBrief) => void;
  rpcLabel: string;
}

type Phase = "idle" | "preparing" | "signing" | "reconciling" | "done" | "error";

export default function OpportunityPublisher({ brief, onSaved, rpcLabel }: OpportunityPublisherProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const reconcile = useReconcilePublication();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  if (!brief) return <p className="tc-muted">Approve a public revision at the Release Desk first.</p>;
  const approved = isApprovalCurrent(brief);
  const live = brief.publication.lastObservedStatus === "live";
  const pending = brief.publication.lastObservedStatus === "pending";

  const run = async (mode: "create" | "update" | "close") => {
    setError(null);
    try {
      if (!address) throw new Error("Connect the project-owner wallet first.");
      if (!walletClient) throw new Error("Wallet client unavailable — reconnect and retry.");
      if (mode === "create" && !approved) throw new Error("Only the currently approved revision can be published.");
      setPhase("preparing");
      const prepared = await briefmintApi.preparePublication(brief.id);
      setPhase("signing");
      const transport = walletClient.transport as unknown as Transport;
      const account = address as Hex;
      let txHash: Hex;
      let entityKey: Hex;
      if (mode === "create") {
        const created = await createOpportunity(transport, account, {
          title: prepared.publicPayload.title,
          summary: prepared.publicPayload.summary,
          category: prepared.publicPayload.category,
          language: "en",
          status: "open",
          budgetCents: prepared.publicPayload.budgetCents,
          contactUrl: prepared.publicPayload.contactUrl,
          deadline: prepared.publicPayload.deadline,
          details: {
            deliverables: prepared.publicPayload.deliverables,
            acceptanceCriteria: prepared.publicPayload.acceptanceCriteria,
            exclusions: prepared.publicPayload.exclusions,
            openQuestions: prepared.publicPayload.openQuestions,
          },
          revision: prepared.publicPayload.revision,
        });
        txHash = created.txHash;
        entityKey = created.entityKey;
      } else if (mode === "update") {
        if (!brief.publication.entityKey) throw new Error("No confirmed entity to update yet.");
        entityKey = brief.publication.entityKey;
        const receipt = await updateOpportunity(transport, account, entityKey, {
          title: prepared.publicPayload.title,
          summary: prepared.publicPayload.summary,
          status: "open",
          contactUrl: prepared.publicPayload.contactUrl,
          details: {
            deliverables: prepared.publicPayload.deliverables,
            acceptanceCriteria: prepared.publicPayload.acceptanceCriteria,
            exclusions: prepared.publicPayload.exclusions,
            openQuestions: prepared.publicPayload.openQuestions,
          },
          revision: prepared.publicPayload.revision,
        });
        txHash = receipt.txHash;
      } else {
        if (!brief.publication.entityKey) throw new Error("No confirmed entity to close yet.");
        entityKey = brief.publication.entityKey;
        const receipt = await closeOpportunity(transport, account, entityKey);
        txHash = receipt.txHash;
      }
      setLastTx(txHash);
      setPhase("reconciling");
      // Reconcile against the recorded approved intent; the server reads the
      // chain and confirms owner/payload/revision/expiry before marking live.
      const confirmed = await reconcile.mutateAsync({ id: brief.id, txHash, entityKey });
      onSaved(confirmed);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      if (isApiError(e)) setError(`${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}`);
      else setError(e instanceof Error ? e.message : "Publication failed.");
    }
  };

  return (
    <section aria-label="Arkiv publication">
      <h3>Owner-signed Arkiv publication</h3>
      <p className="tc-muted">
        Signing wallet must be the project owner. Network: Arkiv Rabdi ({rpcLabel}). A declined signature restores the
        prior confirmed state; the approved revision stays available for retry.
      </p>
      <p>
        Status: <span className="badge badge-info">{brief.publication.lastObservedStatus}</span>{" "}
        <span className="badge">{brief.publication.freshness}</span>
        {pending && <span className="tc-muted"> — confirmation pending, keep polling; do not resubmit blindly.</span>}
      </p>
      {brief.publication.entityKey && (
        <p className="tc-mono tc-muted">Entity: {brief.publication.entityKey}{brief.publication.expiresAtBlock ? ` · expires at block ${brief.publication.expiresAtBlock}` : ""}</p>
      )}
      {lastTx && <p className="tc-mono tc-muted">Last submitted tx: {lastTx} (reconciled, not assumed)</p>}
      {phase === "reconciling" && <p role="status">Reconciling on-chain entity with the backend…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {phase === "done" && <p className="notice" role="status">Reconciliation finished — see the confirmed status above.</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={phase === "signing" || phase === "reconciling" || reconcile.isPending} onClick={() => run(live ? "update" : "create")}>
          {live ? "Sign update (approved revision)" : "Sign publication (approved revision)"}
        </button>
        {live && (
          <button type="button" className="btn btn-danger" disabled={phase === "signing" || phase === "reconciling"} onClick={() => run("close")}>
            Sign closure
          </button>
        )}
      </div>
      {!approved && !live && <p className="tc-muted">Publication prepares only the currently approved revision.</p>}
    </section>
  );
}
