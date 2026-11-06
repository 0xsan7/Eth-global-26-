"use client";
// Brief detail: private intake state, deliberate compilation (POST run — user
// action only, never on mount), structured review with saved revisions, exact
// public preview + approval, owner-signed publication with reconciliation, and
// honest evidence. Polls while running/pending; reopening loads saved state.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/app/AppShell";
import BriefEvidence from "@/components/briefs/BriefEvidence";
import BriefReview from "@/components/briefs/BriefReview";
import OpportunityPublisher from "@/components/briefs/OpportunityPublisher";
import ReleaseDesk from "@/components/briefs/ReleaseDesk";
import { isApiError } from "@/lib/client/briefmint-api";
import { briefmintApi } from "@/lib/client/briefmint-api";
import { useBrief } from "@/lib/client/use-briefs";
import { RABDI_PUBLIC_RPC } from "@/lib/arkiv/opportunities-independent";

export default function BriefDetailPage() {
  const params = useParams();
  const raw = (params as Record<string, string | string[]>).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const valid = typeof id === "string" && id.length > 0;
  const briefQ = useBrief(valid ? id : undefined);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!briefQ.data) return;
    setRunBusy(true);
    setRunError(null);
    try {
      const result = await briefmintApi.runBrief(briefQ.data.id);
      await briefQ.refetch();
      void result;
    } catch (e) {
      setRunError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not start compilation. Retry.");
    } finally {
      setRunBusy(false);
    }
  };

  let body: React.ReactNode;
  if (!valid) {
    body = <p className="error" role="alert">BAD_INPUT: invalid brief id.</p>;
  } else if (briefQ.isLoading) {
    body = <p className="tc-muted">Loading brief…</p>;
  } else if (briefQ.error) {
    const e = briefQ.error;
    if (isApiError(e) && e.status === 401) {
      body = <p className="notice">Connect the project-owner wallet and sign in to open this brief.</p>;
    } else if (isApiError(e) && e.status === 404) {
      body = <p className="error" role="alert">NOT_FOUND: no such brief for this owner.</p>;
    } else if (isApiError(e) && (e.status === 503 || e.code === "SERVICE_UNAVAILABLE")) {
      body = <p className="notice" role="status">BriefMint backend unavailable (503) — the saved brief cannot be reopened yet.</p>;
    } else {
      body = <p className="error" role="alert">{isApiError(e) ? `${e.code}: ${e.message}` : "Could not load the brief."}</p>;
    }
  } else if (!briefQ.data) {
    body = <p className="error" role="alert">NOT_FOUND: no such brief for this owner.</p>;
  } else {
    const brief = briefQ.data;
    const canStart = brief.executionStatus === "draft" || (brief.executionStatus === "failed" && brief.retryEligible);
    body = (
      <>
        <p>
          <span className="badge badge-info">{brief.executionStatus}</span>{" "}
          <span className="badge">{brief.reviewStatus}</span>{" "}
          <span className="badge">{brief.publication.lastObservedStatus}</span>{" "}
          <span className="tc-mono">{brief.id}</span>
        </p>
        {brief.error && <p className="error" role="alert">{brief.error.code}: {brief.error.message}</p>}
        {runError && <p className="error" role="alert">{runError}</p>}
        <div className="card">
          <h2>Private notes (owner-only, immutable after dispatch)</h2>
          {brief.inputSegments.map((s) => (
            <p key={s.id}><span className="tc-mono tc-muted">{s.id}</span> — {s.text}</p>
          ))}
        </div>
        {(canStart) && (
          <div className="card">
            <h2>{brief.executionStatus === "draft" ? "Start compilation" : "Retry compilation"}</h2>
            <p className="tc-muted">Runs once against the configured private model. Maximum bounded attempts; reopening never redispatches.</p>
            <button type="button" className="btn btn-primary" disabled={runBusy} onClick={handleRun}>
              {runBusy ? "Working…" : brief.executionStatus === "draft" ? "Start compilation" : "Retry compilation"}
            </button>
          </div>
        )}
        <div className="card">
          <h2>Review & revise</h2>
          <BriefReview brief={brief} onSaved={() => void briefQ.refetch()} />
        </div>
        <div className="card">
          <h2>Release Desk — approve exactly what publishes</h2>
          <ReleaseDesk brief={brief} onSaved={() => void briefQ.refetch()} />
        </div>
        <div className="card">
          <OpportunityPublisher brief={brief} onSaved={() => void briefQ.refetch()} rpcLabel={RABDI_PUBLIC_RPC} />
        </div>
        <BriefEvidence brief={brief} />
      </>
    );
  }

  return (
    <AppShell>
      <div className="tc-page">
        <p><Link href="/briefs">← My Briefs</Link></p>
        <h1>Brief detail</h1>
        {body}
      </div>
    </AppShell>
  );
}
