"use client";
// Structured review: immutable model output stays intact; edits save as a new
// editable draft revision with optimistic concurrency. Exports use the latest
// SAVED draft, falling back to saved model output. No fake completions.
import { useMemo, useState } from "react";
import { isApiError } from "@/lib/client/briefmint-api";
import { useSaveDraft } from "@/lib/client/use-briefs";
import type { ModelBriefResult, PrivateBrief } from "@/lib/shared/briefmint";

interface BriefReviewProps {
  brief: PrivateBrief;
  onSaved: (brief: PrivateBrief) => void;
}

function savedDraft(brief: PrivateBrief): ModelBriefResult | null {
  return brief.editedDraft ?? brief.immutableModelResult;
}

type SectionKey = "deliverables" | "acceptanceCriteria" | "exclusions" | "openQuestions";
const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "deliverables", label: "Deliverables" },
  { key: "acceptanceCriteria", label: "Acceptance criteria" },
  { key: "exclusions", label: "Exclusions / out of scope" },
  { key: "openQuestions", label: "Open questions" },
];

export function briefResultText(brief: PrivateBrief): string {
  const d = savedDraft(brief);
  if (!d) return "";
  const parts: string[] = [];
  for (const s of SECTIONS) {
    const items = d[s.key].map((i) => `- ${i.text}`).join("\n");
    if (items) parts.push(`${s.label}:\n${items}`);
  }
  return parts.join("\n\n");
}

export default function BriefReview({ brief, onSaved }: BriefReviewProps) {
  const base = useMemo(() => savedDraft(brief), [brief]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>(() => ({
    deliverables: base?.deliverables.map((i) => i.text) ?? [],
    acceptanceCriteria: base?.acceptanceCriteria.map((i) => i.text) ?? [],
    exclusions: base?.exclusions.map((i) => i.text) ?? [],
    openQuestions: base?.openQuestions.map((i) => i.text) ?? [],
  }));
  const [error, setError] = useState<string | null>(null);
  const saveDraft = useSaveDraft();

  const baseKey = base ? JSON.stringify(base) : "";
  const [seenKey, setSeenKey] = useState(baseKey);
  if (seenKey !== baseKey) {
    setSeenKey(baseKey);
    setDrafts({
      deliverables: base?.deliverables.map((i) => i.text) ?? [],
      acceptanceCriteria: base?.acceptanceCriteria.map((i) => i.text) ?? [],
      exclusions: base?.exclusions.map((i) => i.text) ?? [],
      openQuestions: base?.openQuestions.map((i) => i.text) ?? [],
    });
  }

  const editable = brief.executionStatus === "ready";
  const pending = saveDraft.isPending;

  const save = async () => {
    setError(null);
    if (!base) {
      setError("Nothing compiled to edit yet.");
      return;
    }
    const idsFor = (key: SectionKey) => base[key].map((i) => i.id);
    const draft: ModelBriefResult = {
      deliverables: drafts.deliverables.map((text, n) => ({ id: idsFor("deliverables")[n] ?? `d${n + 1}`, text: text.trim(), sourceRefs: base.deliverables[n]?.sourceRefs ?? [] })),
      acceptanceCriteria: drafts.acceptanceCriteria.map((text, n) => ({ id: idsFor("acceptanceCriteria")[n] ?? `a${n + 1}`, text: text.trim(), sourceRefs: base.acceptanceCriteria[n]?.sourceRefs ?? [] })),
      exclusions: drafts.exclusions.map((text, n) => ({ id: idsFor("exclusions")[n] ?? `e${n + 1}`, text: text.trim(), sourceRefs: base.exclusions[n]?.sourceRefs ?? [] })),
      openQuestions: drafts.openQuestions.map((text, n) => ({ id: idsFor("openQuestions")[n] ?? `q${n + 1}`, text: text.trim(), sourceRefs: base.openQuestions[n]?.sourceRefs ?? [] })),
    };
    if (draft.deliverables.some((i) => !i.text)) {
      setError("Deliverables must not contain empty items.");
      return;
    }
    try {
      const updated = await saveDraft.mutateAsync({ id: brief.id, expectedRevision: brief.draftRevision, draft });
      onSaved(updated);
    } catch (e) {
      if (isApiError(e) && e.status === 409) setError("CONFLICT: the brief changed — reload the saved revision before editing.");
      else setError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not save the draft.");
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

  const exportTxt = () => {
    const text = briefResultText(brief);
    if (!text) {
      setError("Nothing saved to export yet.");
      return;
    }
    download(`briefmint-${brief.id.slice(0, 8)}.txt`, `PRIVATE BRIEF (owner-only)\n\n${text}\n`, "text/plain;charset=utf-8");
  };

  const exportJson = () => {
    const d = savedDraft(brief);
    if (!d) {
      setError("Nothing saved to export yet.");
      return;
    }
    download(
      `briefmint-${brief.id.slice(0, 8)}.json`,
      JSON.stringify({ briefId: brief.id, revision: brief.draftRevision, draft: d, exportedAt: new Date().toISOString() }, null, 2),
      "application/json",
    );
  };

  if (!base) return <p className="tc-muted">No compiled result yet. Start compilation at the AI Studio.</p>;

  return (
    <div>
      <h3>
        Review compiled brief{" "}
        {brief.editedDraft ? <span className="badge badge-info">edited draft r{brief.draftRevision}</span> : <span className="badge">model output r{brief.draftRevision}</span>}
      </h3>
      <p className="tc-muted">Model output is immutable; your edits save as a new draft revision. Approval binds the exact saved revision.</p>
      {SECTIONS.map((s) => (
        <div className="review-seg" key={s.key}>
          <strong>{s.label}</strong>
          {(drafts[s.key] ?? []).map((text, n) => (
            <textarea
              key={n}
              value={text}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [s.key]: d[s.key].map((t, i) => (i === n ? e.target.value : t)) }))
              }
              disabled={pending || !editable}
              aria-label={`${s.label} item ${n + 1}`}
            />
          ))}
        </div>
      ))}
      {brief.inferenceEvidence && (
        <p className="tc-muted">
          Model {brief.inferenceEvidence.modelId ?? "not reported"} · provider {brief.inferenceEvidence.providerId ?? "not reported"} · request {brief.inferenceEvidence.requestId ?? "not reported"}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={pending || !editable} onClick={save}>
          {pending ? "Saving…" : `Save draft (r${brief.draftRevision} → r${brief.draftRevision + 1})`}
        </button>
        <button type="button" className="btn" onClick={exportTxt}>Export private TXT</button>
        <button type="button" className="btn" onClick={exportJson}>Export private JSON</button>
      </div>
      {!editable && <p className="tc-muted">Editing is available once compilation is ready. Exports use the saved version.</p>}
    </div>
  );
}
