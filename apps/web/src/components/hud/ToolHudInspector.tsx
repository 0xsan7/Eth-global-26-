import { Boxes, CheckCircle2, CircleDashed, Play, Plus, X } from "lucide-react";
import { useState } from "react";

import { HudButton } from "./HudButton";
import { HudWindow } from "./HudWindow";
import {
  BUILDING_BY_ID,
  countWords,
  shortJobId,
  type BuildingId,
  type ToolJob,
} from "@/lib/tool-city-demo";
import { cn } from "@/lib/utils";

export interface ToolHudInspectorProps {
  selected: BuildingId | null;
  job: ToolJob | null;
  /** Unlocked draft text, used for the live word count before a job exists. */
  draftSource: string;
  onClose: () => void;
  onOpenBoard: () => void;
  onDraft: () => void;
  onVerify: () => void;
  onRun: () => void;
  onReview: () => void;
}

const STATUS_LABEL: Record<ToolJob["status"], string> = {
  awaiting_payment: "awaiting payment",
  paid: "paid · ready to run",
  running: "running",
  ready: "ready",
  failed: "failed",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border border-border/60 bg-background/30 px-1.5 py-1">
      <dt className="inline text-[7px] text-muted-foreground">{label} </dt>
      <dd className="inline" style={tone ? { color: tone } : undefined}>
        {value}
      </dd>
    </div>
  );
}

export function ToolHudInspector({
  selected,
  job,
  draftSource,
  onClose,
  onOpenBoard,
  onDraft,
  onVerify,
  onRun,
  onReview,
}: ToolHudInspectorProps) {
  const [expanded, setExpanded] = useState(true);

  if (!selected) {
    return (
      <p className="hud-caption retro">
        Click a building · Tab to navigate · Each site is one step of the order
      </p>
    );
  }

  const def = BUILDING_BY_ID[selected];
  const words = countWords(job ? job.source : draftSource);

  const action = (() => {
    switch (selected) {
      case "registry":
        return {
          label: "Open workshop board",
          icon: Boxes,
          onClick: onOpenBoard,
          disabled: false,
        };
      case "home":
        return {
          label: job ? "Start a new draft" : "Prepare draft",
          icon: Plus,
          onClick: onDraft,
          disabled: false,
        };
      case "treasury":
        return {
          label:
            job?.status === "awaiting_payment"
              ? "Verify test-USDT payment"
              : job?.status === "paid" || job?.status === "running" || job?.status === "ready"
                ? "Payment verified"
                : "Waiting for a draft",
          icon: CheckCircle2,
          onClick: onVerify,
          disabled: job?.status !== "awaiting_payment",
        };
      case "studio":
        return {
          label:
            job?.status === "paid"
              ? "Run private translation"
              : job?.status === "running"
                ? "Running…"
                : "Run translation",
          icon: Play,
          onClick: onRun,
          disabled: job?.status !== "paid",
        };
      case "archive":
        return {
          label: job?.status === "ready" ? "Review & export" : "Review translation",
          icon: CheckCircle2,
          onClick: onReview,
          disabled: job?.status !== "ready",
        };
    }
  })();

  const ActionIcon = action.icon;

  const jobLine = job ? (
    <div className="grid gap-1 border border-border/50 bg-background/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="hud-label">Current job</span>
        <span
          className={cn(
            "hud-pill",
            job.status === "ready" && "border-emerald-300/40 text-emerald-200",
            job.status === "running" && "border-teal-300/40 text-teal-200",
            job.status === "awaiting_payment" && "border-amber-300/40 text-amber-200",
          )}
        >
          {STATUS_LABEL[job.status]}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <code className="retro truncate text-[9px] text-foreground">{job.title}</code>
        <span className="retro shrink-0 text-[8px] text-muted-foreground">
          {job.costLabel}
        </span>
      </div>
      <span className="retro text-[8px] text-muted-foreground">
        {shortJobId(job.id)} · attempts {job.attemptsUsed} / 2
      </span>
    </div>
  ) : null;

  return (
    <HudWindow
      id="tc-inspector"
      title={def.name}
      hint={def.hint}
      accent={def.accent}
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
      className="w-[min(22rem,100%)]"
      icon={
        <span
          className="hud-mark retro size-[18px] text-[7px]"
          style={{
            backgroundColor: def.accent,
            borderColor: "color-mix(in oklab, currentColor 55%, transparent)",
            color: "#07151e",
          }}
        >
          {def.short.slice(0, 2)}
        </span>
      }
      actions={
        <button
          type="button"
          className="hud-icon-button"
          aria-label="Close site details"
          title="Close"
          onClick={onClose}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      }
    >
      <div className="grid gap-2 p-2.5">
        <p className="retro text-[9px] leading-relaxed text-muted-foreground">
          {def.description}
        </p>

        <dl className="retro flex flex-wrap gap-1.5 text-[9px]">
          <Stat label="SITE" value={def.short} />
          {selected === "registry" ? (
            <>
              <Stat label="WORKSHOPS" value="1" tone="#5fd0bd" />
              <Stat label="STATUS" value="fresh" tone="#5fd0bd" />
            </>
          ) : null}
          {selected === "home" ? (
            <>
              <Stat label="WORDS" value={`${words} / 250`} />
              <Stat label="TARGET" value="HI" tone="#f0b35c" />
            </>
          ) : null}
          {selected === "treasury" ? (
            <>
              <Stat label="PRICE" value="1.00 USDT" tone="#e58a64" />
              <Stat label="CHAIN" value="1874" />
            </>
          ) : null}
          {selected === "studio" ? (
            <>
              <Stat label="MODEL" value="0G private" tone="#5fd0bd" />
              <Stat label="ATTEMPTS" value={job ? `${job.attemptsUsed} / 2` : "0 / 2"} />
            </>
          ) : null}
          {selected === "archive" ? (
            <>
              <Stat label="SAVED" value="1 job" tone="#8fb8d8" />
              <Stat label="EXPORTS" value="ready" />
            </>
          ) : null}
        </dl>

        {jobLine}

        {selected === "treasury" && job?.txHash ? (
          <code className="retro block truncate border border-border/50 bg-background/20 px-1.5 py-1 text-[8px] text-muted-foreground">
            test-USDT tx {shortJobId(job.txHash)}
          </code>
        ) : null}

        {selected === "studio" && job?.requestId ? (
          <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
            <CircleDashed className="size-3" aria-hidden="true" />
            <span className="retro truncate">
              {job.modelId} · {job.requestId}
            </span>
          </div>
        ) : null}

        <HudButton
          type="button"
          size="sm"
          variant={action.disabled ? "outline" : "primary"}
          onClick={action.onClick}
          disabled={action.disabled}
          className="w-full justify-center"
        >
          <ActionIcon className="size-3" aria-hidden="true" />
          {action.label}
        </HudButton>
      </div>
    </HudWindow>
  );
}

export default ToolHudInspector;
