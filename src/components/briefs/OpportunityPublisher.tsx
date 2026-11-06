"use client";
// Owner publication: prepare an approved intent with the backend, sign the
// Arkiv write with the connected project-owner wallet, then reconcile the
// confirmed entity with the backend. A submitted transaction alone is never
// treated as success — `pending` stays until the server confirms owner,
// payload, revision, and expiry. Never requests a private key; signing
// happens in the browser wallet. Intent and broadcast identifiers are
// persisted locally (non-sensitive) before reporting success.
import { useState } from "react";
import { isApiError } from "@/lib/client/briefmint-api";
import { useReconcilePublication, useRefreshPublication } from "@/lib/client/use-briefs";
import {
  arkivBroadcastTransactionHash,
  writeArkivIntent,
} from "@/lib/arkiv/briefmint/write";
import {
  hashPublicOpportunity,
  projectPublicOpportunity,
  validatePublicationIntent,
  type BriefView,
  type Hex,
} from "@/lib/shared/briefmint";

interface OpportunityPublisherProps {
  brief: BriefView | null;
  onSaved: (b: BriefView) => void;
  rpcLabel: string;
}

type Phase = "idle" | "preparing" | "signing" | "reconciling" | "done" | "error";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function randomIntentId(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function intentStorageKey(briefId: string): string {
  return `briefmint.pendingIntent.${briefId}`;
}

export default function OpportunityPublisher({ brief, onSaved, rpcLabel }: OpportunityPublisherProps) {
  const [accessKey, setAccessKey] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const reconcile = useReconcilePublication();
  const refresh = useRefreshPublication();

  if (!brief) return <p className="tc-muted">Approve a public revision at the Release Desk first.</p>;
  const approval = brief.review.status === "approved" ? brief.review.approval : null;
  const approved = approval !== null && approval.draftRevision === brief.draftRevision;
  const confirmed = brief.publication.confirmed;
  const pending = brief.publication.pending;
  const live = brief.publication.status === "live";

  const run = async (operation: "create" | "update" | "close") => {
    setError(null);
    try {
      if (!brief.editedDraft) throw new Error("No saved draft to publish — compile and save first.");
      if (!approved) throw new Error("Only the currently approved revision can be published.");
      if (!accessKey.trim()) throw new Error("Enter an Arkiv access key to sign and read (a public rate-limit key; never committed).");
      if (typeof window === "undefined" || !(window as unknown as { ethereum?: EthereumProvider }).ethereum) {
        throw new Error("Install or unlock an EVM browser wallet first.");
      }
      const provider = (window as unknown as { ethereum: EthereumProvider }).ethereum;
      setPhase("preparing");
      const intentId = randomIntentId();
      const hash = await hashPublicOpportunity(projectPublicOpportunity(brief.editedDraft, brief.draftRevision));
      const { briefmintApi } = await import("@/lib/client/briefmint-api");
      const intent = await briefmintApi.preparePublication(brief.id, {
        intentId,
        expectedRevision: brief.draftRevision,
        publicPayloadHash: hash,
        operation,
      });
      await validatePublicationIntent(intent);
      try {
        localStorage.setItem(intentStorageKey(brief.id), JSON.stringify({ intentId, operation }));
      } catch {
        /* Local persistence is best-effort. */
      }
      setPhase("signing");
      let transactionHash: Hex;
      let entityKey: Hex;
      try {
        const receipt = await writeArkivIntent(intent, accessKey.trim(), provider);
        transactionHash = receipt.transactionHash as Hex;
        entityKey = receipt.entityKey as Hex;
      } catch (e) {
        const uncertain = arkivBroadcastTransactionHash(e);
        if (!uncertain) throw e;
        transactionHash = uncertain as Hex;
        entityKey = (intent.entityKey ?? "") as Hex;
        setLastTx(transactionHash);
        setPhase("reconciling");
        const confirmedBrief = await reconcile.mutateAsync({
          id: brief.id,
          req: { intentId, transactionHash, entityKey: entityKey || null },
        });
        onSaved(confirmedBrief);
        setPhase("done");
        return;
      }
      setLastTx(transactionHash);
      try {
        localStorage.setItem(
          intentStorageKey(brief.id),
          JSON.stringify({ intentId, transactionHash, entityKey }),
        );
      } catch {
        /* Local persistence is best-effort. */
      }
      setPhase("reconciling");
      // Reconcile against the recorded approved intent; the server reads the
      // chain and confirms owner/payload/revision/expiry before marking live.
      const confirmedBrief = await reconcile.mutateAsync({
        id: brief.id,
        req: { intentId, transactionHash, entityKey },
      });
      try {
        localStorage.removeItem(intentStorageKey(brief.id));
      } catch {
        /* Local persistence is best-effort. */
      }
      onSaved(confirmedBrief);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      if (isApiError(e)) setError(`${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}`);
      else setError(e instanceof Error ? e.message : "Publication failed.");
    }
  };

  const doRefresh = async () => {
    setError(null);
    try {
      const updated = await refresh.mutateAsync(brief.id);
      onSaved(updated);
    } catch (e) {
      setError(isApiError(e) ? `${e.code}: ${e.message}` : "Refresh failed.");
    }
  };

  return (
    <section aria-label="Arkiv publication">
      <h3>Owner-signed Arkiv publication</h3>
      <p className="tc-muted">
        Signing wallet must be the project owner. Network: Arkiv Rabdi ({rpcLabel}). A declined signature restores the
        prior confirmed state; the approved revision stays available for retry.
      </p>
      <div className="form-field">
        <label htmlFor="arkiv-access-key">Arkiv access key (public rate-limit key; never committed)</label>
        <input
          id="arkiv-access-key"
          type="text"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          placeholder="Paste operator-provided key"
          autoComplete="off"
        />
      </div>
      <p>
        Status: <span className="badge badge-info">{brief.publication.status}</span>{" "}
        <span className="badge">{brief.publication.freshness}</span>
        {pending && <span className="tc-muted"> — intent {pending.state}; keep polling, do not resubmit blindly.</span>}
      </p>
      {confirmed && (
        <p className="tc-mono tc-muted">
          Entity: {confirmed.entityKey} · r{confirmed.publicRevision} · {confirmed.status}
          {confirmed.expiresAtBlock ? ` · expires at block ${confirmed.expiresAtBlock}` : ""}
        </p>
      )}
      {lastTx && <p className="tc-mono tc-muted">Last submitted tx: {lastTx} (reconciled, not assumed)</p>}
      {phase === "reconciling" && <p role="status">Reconciling on-chain entity with the backend…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {phase === "done" && <p className="notice" role="status">Reconciliation finished — see the confirmed status above.</p>}
      <div className="btn-row">
        {!confirmed && (
          <button type="button" className="btn btn-primary" disabled={phase === "signing" || phase === "reconciling" || reconcile.isPending} onClick={() => run("create")}>
            Sign publication (approved revision)
          </button>
        )}
        {live && (
          <>
            <button type="button" className="btn btn-primary" disabled={phase === "signing" || phase === "reconciling" || reconcile.isPending} onClick={() => run("update")}>
              Sign update (approved revision)
            </button>
            <button type="button" className="btn btn-danger" disabled={phase === "signing" || phase === "reconciling"} onClick={() => run("close")}>
              Sign closure
            </button>
          </>
        )}
        <button type="button" className="btn" disabled={refresh.isPending} onClick={doRefresh}>
          {refresh.isPending ? "Refreshing…" : "Refresh chain observation"}
        </button>
      </div>
      {!approved && <p className="tc-muted">Publication prepares only the currently approved revision.</p>}
    </section>
  );
}
