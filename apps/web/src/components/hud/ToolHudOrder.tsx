import { Lock, Plus } from "lucide-react";
import { useState } from "react";

import { HudButton } from "./HudButton";
import { HudWindow } from "./HudWindow";
import {
  countWords,
  isSourceValid,
  type ToolJob,
} from "@/lib/tool-city-demo";
import { cn } from "@/lib/utils";

export interface ToolHudOrderProps {
  source: string;
  onSourceChange: (value: string) => void;
  job: ToolJob | null;
  onPrimary: () => void;
  onNewDraft: () => void;
  onOpenBoard: () => void;
}

function primaryLabel(job: ToolJob | null): string {
  switch (job?.status) {
    case undefined:
      return "Create job";
    case "awaiting_payment":
      return "Pay at Treasury";
    case "paid":
      return "Run translation";
    case "running":
      return "Translating…";
    case "ready":
      return "Review & export";
    case "failed":
      return "Try again";
  }
}

export function ToolHudOrder({
  source,
  onSourceChange,
  job,
  onPrimary,
  onNewDraft,
  onOpenBoard,
}: ToolHudOrderProps) {
  // Short windows cannot fit scan + inspector + the full order detail at once.
  // Collapse the body by default there; the source field and primary CTA stay
  // visible in the persistent row, so the order remains actionable.
  const [expanded, setExpanded] = useState(
    () => typeof window === "undefined" || window.innerHeight >= 820,
  );
  const [reviewMode, setReviewMode] = useState<"aligned" | "notes">("aligned");
  const words = countWords(source);
  const valid = isSourceValid(source);
  const locked = Boolean(job);
  const running = job?.status === "running";
  const cta = primaryLabel(job);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onPrimary();
      }}
      className="hud-form relative z-10 w-[min(34rem,100%)]"
    >
      <HudWindow
        id="tc-order"
        title="Translation order"
        hint={job ? job.status.replaceAll("_", " ") : undefined}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        bodyClassName="grid gap-2 p-2.5 overflow-visible"
        meta={<span className="hud-pill">{words} / 250 words</span>}
        persistent={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="hud-field tc-order-field min-w-0 flex-1">
              <span aria-hidden="true" className="hud-field__caret">
                {locked ? <Lock className="size-3" aria-hidden="true" /> : "❯"}
              </span>
              <textarea
                id="tc-source"
                className="hud-field__input retro tc-source"
                value={source}
                onChange={(event) => onSourceChange(event.target.value)}
                placeholder="Paste the English source notice to translate…"
                aria-label="English source text"
                rows={2}
                maxLength={5000}
                disabled={locked}
                spellCheck={false}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {locked ? (
                <HudButton
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onNewDraft}
                  title="Start a new draft"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  New
                </HudButton>
              ) : null}
              <HudButton
                type="submit"
                size="md"
                disabled={!valid || running}
              >
                {cta}
              </HudButton>
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="hud-label">
            {locked ? "Source locked at job creation" : "Draft source · English"}
          </span>
          <span
            className={cn(
              "retro text-[8px]",
              words > 250 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {words} words · 5,000 chars max
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="hud-label">Workshop</span>
          <HudButton
            type="button"
            size="auto"
            variant="outline"
            onClick={onOpenBoard}
            className="justify-start gap-2 text-left"
          >
            <span className="grid size-6 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-[9px] text-primary">
              अ
            </span>
            <span className="min-w-0">
              <span className="block text-[8px] text-primary">Hindi Translation Works</span>
              <span className="block text-[8px] text-muted-foreground">
                EN → HI · 1.00 test USDT
              </span>
            </span>
          </HudButton>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="hud-label">Review</span>
          <div className="flex gap-1.5" role="group" aria-label="Review preference">
            <HudButton
              type="button"
              size="sm"
              variant={reviewMode === "aligned" ? "primary" : "outline"}
              aria-pressed={reviewMode === "aligned"}
              onClick={() => setReviewMode("aligned")}
            >
              Aligned
            </HudButton>
            <HudButton
              type="button"
              size="sm"
              variant={reviewMode === "notes" ? "primary" : "outline"}
              aria-pressed={reviewMode === "notes"}
              onClick={() => setReviewMode("notes")}
            >
              Notes
            </HudButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-t border-border/40 pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label">Attempts</span>
            <span className="retro text-[8px] text-foreground">
              {job?.attemptsUsed ?? 0} / 2
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label">Segments</span>
            <span className="retro text-[8px] text-foreground">
              {job?.sourceSegments.length ?? Math.max(1, source.trim().split(/\n\s*\n/).filter(Boolean).length)} / 20
            </span>
          </div>
        </div>

        <p className="retro text-[8px] leading-relaxed text-muted-foreground">
          {job?.status === "awaiting_payment"
            ? "Draft saved. Pay the fixed 1.00 test USDT at the Treasury; the server verifies the receipt before the studio can run."
            : job?.status === "paid"
              ? "Entitlement verified. The studio dispatches one private translation run; a retry is only available after a reported failure."
              : job?.status === "running"
                ? "The provider is working. Keep this window open; the saved result lands in the Archive."
                : job?.status === "ready"
                  ? reviewMode === "aligned"
                    ? "Result is ready for source-aligned review. Keep the model text intact; edits are saved beside it."
                    : "Result is ready. Use the Archive to compare each source segment with the saved translation."
                  : reviewMode === "aligned"
                    ? "The source splits on blank paragraphs and is capped at 20 aligned segments. Nothing is sent until you pay and deliberately run the job."
                    : "Review notes are local to this session. Saved model text is never overwritten by edits."}
        </p>
      </HudWindow>
    </form>
  );
}

export default ToolHudOrder;
