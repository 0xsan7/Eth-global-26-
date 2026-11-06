"use client";
// TranslationReview: source-aligned review by stable segment id.
// Edits stay local with an unsaved indicator; Save sends the complete
// segment set. Exports use the latest SAVED edited version, falling back
// to saved model output. Edited text is never labelled as model output.
import { useMemo, useState } from "react";
import { api, isApiError } from "@/lib/client/api-client";
import type { JobView, TranslationSegment } from "@/lib/shared/domain";

interface TranslationReviewProps {
  job: JobView;
  onSaved: (job: JobView) => void;
}

function savedResult(job: JobView): TranslationSegment[] | null {
  return job.editedSegments ?? job.modelSegments;
}

export function resultText(job: JobView): string {
  const segs = savedResult(job);
  return segs ? segs.map((s) => s.text).join("\n\n") : "";
}

export default function TranslationReview({ job, onSaved }: TranslationReviewProps) {
  const base: TranslationSegment[] = useMemo(
    () => job.editedSegments ?? job.modelSegments ?? [],
    [job.editedSegments, job.modelSegments],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(base.map((s) => [s.id, s.text])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed local drafts when a newly saved job arrives.
  const baseKey = base.map((s) => `${s.id}=${s.text}`).join("|");
  const [seenKey, setSeenKey] = useState(baseKey);
  if (seenKey !== baseKey) {
    setSeenKey(baseKey);
    setDrafts(Object.fromEntries(base.map((s) => [s.id, s.text])));
  }

  const unsaved = base.some((s) => (drafts[s.id] ?? "") !== s.text);
  const editable = job.status === "ready";

  const save = async () => {
    setError(null);
    const segments: TranslationSegment[] = job.sourceSegments.map((src) => ({
      id: src.id,
      text: (drafts[src.id] ?? "").trim(),
    }));
    if (segments.some((s) => !s.text)) {
      setError("Every segment needs translated text before saving.");
      return;
    }
    setBusy(true);
    try {
      const updated = await api.patchEdits(job.id, segments);
      onSaved(updated);
    } catch (e) {
      if (isApiError(e)) setError(`${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}`);
      else setError("Could not save edits. Retry.");
    } finally {
      setBusy(false);
    }
  };

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const short = job.id.slice(2, 10);
  const exportTxt = () => {
    const text = resultText(job);
    if (!text) {
      setError("Nothing saved to export yet.");
      return;
    }
    download(`tool-city-${short}.txt`, text + "\n", "text/plain;charset=utf-8");
  };
  const exportJson = () => {
    const segs = savedResult(job);
    if (!segs) {
      setError("Nothing saved to export yet.");
      return;
    }
    // Buyer-authorized only: everything here came from this buyer's authorized job fetch.
    const payload = {
      jobId: job.id,
      source: job.sourceSegments,
      result: segs,
      edited: job.editedSegments !== null,
      receipt: job.payment,
      evidence: job.evidence,
      exportedAt: new Date().toISOString(),
    };
    download(`tool-city-${short}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  if (!job.modelSegments) return <p className="tc-muted">No translation yet. Run the job first.</p>;

  return (
    <div>
      <h3>
        Review translation{" "}
        {job.editedSegments ? (
          <span className="badge badge-info">edited version saved</span>
        ) : (
          <span className="badge">model output</span>
        )}{" "}
        {unsaved && <span className="badge badge-stale">unsaved edits</span>}
      </h3>
      {job.sourceSegments.map((src) => {
        const model = job.modelSegments?.find((m) => m.id === src.id);
        return (
          <div className="review-seg" key={src.id}>
            <p className="tc-mono tc-muted">{src.id}</p>
            <div className="source-text">
              <strong>Source (en):</strong> {src.text}
            </div>
            <div>
              <strong>Translation (hi):</strong>
              <textarea
                value={drafts[src.id] ?? model?.text ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [src.id]: e.target.value }))}
                disabled={busy || !editable}
                aria-label={`Hindi translation for ${src.id}`}
              />
            </div>
          </div>
        );
      })}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy || !editable || !unsaved} onClick={save}>
          {busy ? "Saving…" : "Save edits"}
        </button>
        <button type="button" className="btn" onClick={exportTxt}>
          Export TXT
        </button>
        <button type="button" className="btn" onClick={exportJson}>
          Export JSON
        </button>
      </div>
      {!editable && <p className="tc-muted">Editing is available once the job is ready. Exports use the saved version.</p>}
      <p className="tc-muted">TXT holds the clean translation. JSON holds source, result, receipt and evidence.</p>
    </div>
  );
}
