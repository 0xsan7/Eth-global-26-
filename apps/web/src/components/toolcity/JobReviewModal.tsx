import { Download, Save, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";

import { HudButton } from "@/components/hud/HudButton";
import {
  type ToolJob,
  type TranslationSegment,
  shortJobId,
} from "@/lib/tool-city-demo";

export interface JobReviewModalProps {
  job: ToolJob;
  onClose: () => void;
  onSave: (segments: TranslationSegment[]) => void;
}

export function JobReviewModal({ job, onClose, onSave }: JobReviewModalProps) {
  const [drafts, setDrafts] = useState<TranslationSegment[]>(() =>
    (job.edited ?? job.translation ?? []).map((segment) => ({ ...segment })),
  );
  const saved = job.edited ?? job.translation ?? [];
  const dirty = useMemo(
    () =>
      drafts.some(
        (segment, index) => segment.text !== (saved[index]?.text ?? ""),
      ),
    [drafts, saved],
  );

  function updateSegment(id: string, text: string): void {
    setDrafts((current) =>
      current.map((segment) => (segment.id === id ? { ...segment, text } : segment)),
    );
  }

  function exportText(): void {
    const lines = drafts.map(
      (segment, index) =>
        `[${segment.id}]\nEN: ${job.sourceSegments[index]?.text ?? ""}\nHI: ${segment.text}\n`,
    );
    const blob = new Blob(
      [
        `Tool City — ${job.title}\nJob ${job.id}\nDemo export · test USDT · no server write\nSaved ${new Date().toISOString()}\n\n`,
        ...lines,
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tool-city-${shortJobId(job.id).replace("…", "-")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="tc-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tc-review-title"
        className="hud-window tc-modal-window"
        data-expanded="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span aria-hidden="true" className="hud-window__frame" />
        <header className="hud-window__bar">
          <span aria-hidden="true" className="hud-window__tick" />
          <h2 id="tc-review-title" className="hud-window__title retro">
            Job review
          </h2>
          <span className="hud-window__hint retro">en → hi</span>
          <span aria-hidden="true" className="hud-window__leader" />
          <span className="hud-pill">
            <span aria-hidden="true" className="hud-dot hud-dot--live" />
            {job.status} · demo
          </span>
          <button
            type="button"
            className="hud-icon-button"
            aria-label="Close review"
            title="Close"
            onClick={onClose}
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </header>

        <div className="tc-modal-body">
          <div className="tc-modal-meta">
            <div>
              <span className="hud-label">Job</span>
              <code className="retro block truncate text-[9px] text-foreground">
                {shortJobId(job.id)}
              </code>
            </div>
            <div>
              <span className="hud-label">Demo payment</span>
              <span className="retro block text-[9px] text-foreground">
                {job.txHash ? `test-USDT tx ${shortJobId(job.txHash)}` : "—"}
              </span>
            </div>
            <div>
              <span className="hud-label">Model</span>
              <span className="retro block truncate text-[9px] text-foreground">
                {job.modelId ?? "—"}
              </span>
            </div>
            <div>
              <span className="hud-label">Attempts</span>
              <span className="retro block text-[9px] text-foreground">
                {job.attemptsUsed} / 2
              </span>
            </div>
            <div>
              <span className="hud-label">Evidence</span>
              <span className="retro flex items-center gap-1 text-[9px] text-emerald-300">
                <ShieldCheck className="size-3" aria-hidden="true" />
                router TEE {job.routerTeeVerified ? "reported" : "unavailable"} · demo
              </span>
            </div>
            <div>
              <span className="hud-label">Cost</span>
              <span className="retro block text-[9px] text-foreground">
                {job.costLabel}
              </span>
            </div>
          </div>

          <div className="tc-review-head" aria-hidden="true">
            <span className="hud-label">Source · English</span>
            <span className="hud-label">Saved translation · Hindi</span>
          </div>

          <div className="tc-review-list">
            {job.sourceSegments.map((segment, index) => {
              const translation =
                drafts[index] ?? { id: segment.id, text: "" };
              return (
                <article key={segment.id} className="tc-review-segment">
                  <div className="tc-review-source">
                    <span className="retro text-[7px] text-muted-foreground">
                      {segment.id}
                    </span>
                    <p className="retro text-[10px] leading-relaxed text-foreground">
                      {segment.text}
                    </p>
                  </div>
                  <div className="tc-review-translation">
                    <span className="retro flex items-center justify-between text-[7px] text-muted-foreground">
                      <span>{translation.id}</span>
                      <span>{translation.text.split(/\s+/).filter(Boolean).length} words</span>
                    </span>
                    <textarea
                      className="retro tc-review-input"
                      value={translation.text}
                      onChange={(event) => updateSegment(translation.id, event.target.value)}
                      rows={4}
                      aria-label={`Hindi translation for ${segment.id}`}
                      spellCheck={false}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <p className="retro text-[8px] leading-relaxed text-muted-foreground">
            Saving keeps the model output intact and stores your edits beside it.
            Export uses the saved edited version, or the saved model version when
            unedited. This demo does not write to a server.
          </p>
        </div>

        <footer className="tc-modal-footer">
          <span className="retro text-[8px] text-muted-foreground">
            {dirty ? "Unsaved edits" : job.edited ? "Saved edits" : "Saved model version"}
          </span>
          <div className="flex flex-wrap gap-2">
            <HudButton type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </HudButton>
            <HudButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSave(drafts)}
              disabled={!dirty}
            >
              <Save className="mr-1 size-3" aria-hidden="true" />
              Save edits
            </HudButton>
            <HudButton type="button" size="sm" onClick={exportText}>
              <Download className="mr-1 size-3" aria-hidden="true" />
              Export .txt
            </HudButton>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default JobReviewModal;
