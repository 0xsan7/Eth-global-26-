"use client";
// Honest inference evidence: requested policy, Router-reported verification,
// and independent verification stay separate. Null means unknown, never success.
import type { PrivateBrief } from "@/lib/shared/briefmint";

export default function BriefEvidence({ brief }: { brief: PrivateBrief }) {
  const ev = brief.inferenceEvidence;
  return (
    <div className="card">
      <h3>Compilation evidence</h3>
      <dl>
        <div><dt>Execution</dt><dd>{brief.executionStatus} · attempts used {brief.attemptsUsed}{brief.retryEligible ? " · retry eligible" : ""}</dd></div>
        <div><dt>Review</dt><dd>{brief.reviewStatus}{brief.approval ? ` · approved r${brief.approval.draftRevision}` : ""}</dd></div>
        <div><dt>Publication</dt><dd>{brief.publication.lastObservedStatus} ({brief.publication.freshness})</dd></div>
      </dl>
      <h4>0G private request</h4>
      {ev ? (
        <dl>
          <div><dt>Request ID</dt><dd className="tc-mono">{ev.requestId ?? "not reported"}</dd></div>
          <div><dt>Model</dt><dd className="tc-mono">{ev.modelId ?? "not reported"}</dd></div>
          <div><dt>Provider</dt><dd className="tc-mono">{ev.providerId ?? "not reported"}</dd></div>
          <div><dt>Routing tier</dt><dd>{ev.routingTier ?? "not reported"}</dd></div>
          <div><dt>Private verification requested</dt><dd>{ev.verificationRequested ? "yes" : "no"}</dd></div>
          <div><dt>Router-reported TEE verification</dt><dd>
            {ev.routerTeeVerified === null || ev.routerTeeVerified === undefined ? (
              <span className="badge">not reported — not verified</span>
            ) : ev.routerTeeVerified ? (
              <span className="badge badge-ready">router reports verified</span>
            ) : (
              <span className="badge badge-bad">router reports unverified</span>
            )}
          </dd></div>
          <div><dt>Independent response verification</dt><dd>
            {ev.independentVerified === null || ev.independentVerified === undefined ? (
              <span className="badge">not performed — unknown</span>
            ) : ev.independentVerified ? (
              <span className="badge badge-ready">independently verified</span>
            ) : (
              <span className="badge badge-bad">independent check failed</span>
            )}
          </dd></div>
        </dl>
      ) : (
        <p className="tc-muted">Compilation evidence unavailable — not reported, not success.</p>
      )}
      {brief.error && <p className="error" role="alert">{brief.error.code}: {brief.error.message}</p>}
      <p className="tc-muted">Private notes and model internals are never exposed here. Verification labels distinguish what was requested, what the Router reported, and what was independently checked.</p>
    </div>
  );
}
