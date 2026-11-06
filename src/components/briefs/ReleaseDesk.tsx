"use client";
// Release Desk (Treasury): exact public preview + explicit approval.
// Approval binds the canonical public payload hash and the saved revision;
// any later public-content edit invalidates it. Public preview is allowlist
// only — private notes, source IDs, and database IDs never appear here.
import { useState } from "react";
import { isApiError } from "@/lib/client/briefmint-api";
import { useApproveBrief } from "@/lib/client/use-briefs";
import type { PrivateBrief } from "@/lib/shared/briefmint";
import {
  hashPublicPayload,
  isApprovalCurrent,
  projectPublicPayload,
} from "@/lib/shared/briefmint-validation";

export default function ReleaseDesk({ brief, onSaved }: { brief: PrivateBrief | null; onSaved: (b: PrivateBrief) => void }) {
  const [error, setError] = useState<string | null>(null);
  const approve = useApproveBrief();

  if (!brief) return <p className="tc-muted">Save a private brief at the Creator&apos;s Home first.</p>;
  if (!brief.editedDraft && !brief.immutableModelResult)
    return <p className="tc-muted">Nothing compiled to preview yet — run compilation at the AI Studio.</p>;

  let preview;
  try {
    preview = projectPublicPayload(brief);
  } catch (e) {
    return <p className="error" role="alert">{e instanceof Error ? e.message : "Cannot build public preview."}</p>;
  }
  const hash = hashPublicPayload(preview);
  const current = isApprovalCurrent(brief);
  const stale = brief.reviewStatus === "approved" && !current;

  const doApprove = async () => {
    setError(null);
    try {
      const updated = await approve.mutateAsync({ id: brief.id, expectedRevision: brief.draftRevision, publicPayloadHash: hash });
      onSaved(updated);
    } catch (e) {
      if (isApiError(e) && e.status === 409) setError("CONFLICT: revision changed — review the current preview before approving.");
      else setError(isApiError(e) ? `${e.code}: ${e.message}` : "Approval failed.");
    }
  };

  return (
    <div>
      <h3>Exact public preview (revision r{preview.revision})</h3>
      {stale && (
        <p className="error" role="alert">
          Approval invalidated: the public candidate changed after approval. Review and approve the current revision before publishing.
        </p>
      )}
      {current && brief.approval && (
        <p className="notice" role="status">
          Approved by <span className="tc-mono">{brief.approval.approvedBy}</span> at {brief.approval.approvedAt}. Hash{" "}
          <span className="tc-mono">{brief.approval.publicPayloadHash.slice(0, 18)}…</span>
        </p>
      )}
      <dl>
        <div><dt>Title</dt><dd>{preview.title}</dd></div>
        <div><dt>Summary</dt><dd>{preview.summary}</dd></div>
        <div><dt>Category / language</dt><dd>{preview.category} / {preview.language}</dd></div>
        <div><dt>Budget (unfunded)</dt><dd>{preview.budgetCents === null ? "not advertised" : `$${(preview.budgetCents / 100).toFixed(2)} (${preview.budgetCents}¢)`}</dd></div>
        <div><dt>Contact</dt><dd className="tc-mono">{preview.contactUrl ?? "none"}</dd></div>
        <div><dt>Deadline</dt><dd className="tc-mono">{preview.deadline}</dd></div>
      </dl>
      {(["deliverables", "acceptanceCriteria", "exclusions", "openQuestions"] as const).map((k) => (
        <div key={k}>
          <h4 style={{ textTransform: "capitalize" }}>{k}</h4>
          {preview[k].length === 0 ? <p className="tc-muted">None.</p> : <ul>{preview[k].map((t, i) => <li key={i}>{t}</li>)}</ul>}
        </div>
      ))}
      <p className="tc-muted">
        Canonical hash: <span className="tc-mono">{hash}</span>
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={approve.isPending || current} onClick={doApprove}>
          {approve.isPending ? "Approving…" : current ? "Approved (current)" : `Approve revision r${preview.revision} for publication`}
        </button>
      </div>
      <p className="tc-muted">Approval records the exact payload hash above. Publishing a different revision requires a new approval.</p>
    </div>
  );
}
