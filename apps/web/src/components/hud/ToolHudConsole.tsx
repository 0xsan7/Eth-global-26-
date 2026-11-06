import {
  Command,
  Languages,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { useAudio } from "@/components/audio-provider";
import { useFps } from "@/components/fps-provider";
import { cn } from "@/lib/utils";
import type { ToolJob } from "@/lib/tool-city-demo";
import { formatWhen, WORKSHOP } from "@/lib/tool-city-demo";
import { HudButton } from "./HudButton";
import { HudMeter } from "./HudMeter";
import { HudWindow } from "./HudWindow";
import { ToolJobList } from "./ToolJobList";

export interface ToolHudConsoleProps {
  jobs: ToolJob[];
  job: ToolJob | null;
  onOpenJob: (job: ToolJob) => void;
  onOpenArchive: () => void;
  onOpenBoard: () => void;
  onStartDraft: () => void;
  onVerify: () => void;
  onRun: () => void;
  onReview: () => void;
}

function nextStep(job: ToolJob | null): {
  label: string;
  detail: string;
  onClick?: "draft" | "verify" | "run" | "review";
  disabled?: boolean;
} {
  switch (job?.status) {
    case undefined:
      return {
        label: "Start a draft",
        detail: "Write or paste an English notice at Creator's Home.",
        onClick: "draft",
      };
    case "awaiting_payment":
      return {
        label: "Pay at Treasury",
        detail: "1.00 test USDT · Whitechain 1874.",
        onClick: "verify",
      };
    case "paid":
      return {
        label: "Run translation",
        detail: "Entitlement verified. Dispatch one private 0G run.",
        onClick: "run",
      };
    case "running":
      return {
        label: "Translating…",
        detail: "The saved result will land in the Archive.",
        disabled: true,
      };
    case "ready":
      return {
        label: "Review & export",
        detail: "Compare segments, save edits, export the saved version.",
        onClick: "review",
      };
    case "failed":
      return {
        label: "Retry allowed",
        detail: "One manual retry remains.",
        onClick: "run",
      };
  }
}

export function ToolHudConsole({
  jobs,
  job,
  onOpenJob,
  onOpenArchive,
  onOpenBoard,
  onStartDraft,
  onVerify,
  onRun,
  onReview,
}: ToolHudConsoleProps) {
  const [expanded, setExpanded] = useState(true);
  const { sfxEnabled, toggleSfx } = useAudio();
  const { targetFps, toggleTargetFps } = useFps();

  const paid = job?.status === "paid" || job?.status === "running" || job?.status === "ready";
  const spent = paid ? 1 : 0;
  const step = nextStep(job);
  const action =
    step.onClick === "draft"
      ? onStartDraft
      : step.onClick === "verify"
        ? onVerify
        : step.onClick === "run"
          ? onRun
          : step.onClick === "review"
            ? onReview
            : undefined;

  return (
    <div className="hud-column hud-column--console">
      <HudWindow
        id="tc-console"
        title="Tool City"
        fill
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        bodyClassName="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5"
        meta={
          <span className="hud-pill">
            <span aria-hidden="true" className="hud-dot hud-dot--live" />
            demo
          </span>
        }
        actions={
          <>
            <span
              className="hud-pill retro"
              title={`${WORKSHOP.owner} · Whitechain 1874`}
            >
              <Wallet className="size-2.5" aria-hidden="true" />
              {WORKSHOP.owner.slice(0, 6)}…
            </span>
            <button
              type="button"
              className="hud-icon-button"
              aria-label={sfxEnabled ? "Mute sound" : "Unmute sound"}
              aria-pressed={!sfxEnabled}
              title={sfxEnabled ? "Mute sound" : "Unmute sound"}
              onClick={toggleSfx}
            >
              {sfxEnabled ? (
                <Volume2 className="size-3" aria-hidden="true" />
              ) : (
                <VolumeX className="size-3" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="hud-icon-button retro gap-0.5 px-1 text-[8px]"
              aria-label="Open the workshop terminal"
              title="Workshop terminal"
              onClick={onOpenBoard}
            >
              <Command className="size-2.5" aria-hidden="true" />K
            </button>
            <button
              type="button"
              className="hud-icon-button retro px-1.5 text-[8px]"
              aria-label={`Target framerate: ${targetFps} FPS`}
              title={`Framerate: ${targetFps} FPS`}
              onClick={toggleTargetFps}
            >
              {targetFps} FPS
            </button>
          </>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label">Permits · buyer</span>
            <span className="hud-label">250 words max</span>
          </div>
        }
      >
        <div className="hud-masthead justify-between">
          <div className="min-w-0">
            <h1 className="hud-masthead__name retro">HINDI TRANSLATION WORKS</h1>
            <p className="hud-masthead__sub retro">main city · buyer console</p>
            <p className="hud-masthead__detail retro">
              demo · test USDT · workshop {WORKSHOP.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="tc-workshop-icon" aria-hidden="true">
            <Languages className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="hud-label">Focused workshop</span>
            <p className="retro truncate text-[11px] text-foreground">
              {WORKSHOP.title}
            </p>
            <p className="retro truncate text-[9px] text-muted-foreground">
              EN → HI · {WORKSHOP.priceLabel} · source-aligned review
            </p>
            <p className="retro truncate text-[8px] text-emerald-300/80">
              Arkiv fresh · 0G private inference
            </p>
          </div>
        </div>

        <HudMeter
          label="Treasury · test USDT"
          readout={`$${spent.toFixed(2)} / $1.00`}
          value={spent * 100}
        />

        <div className="grid gap-1.5 border border-border/50 bg-background/25 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label">Next step</span>
            {job ? (
              <span className="retro text-[8px] text-muted-foreground">
                {formatWhen(job.updatedAt)}
              </span>
            ) : (
              <span className="retro text-[8px] text-muted-foreground">demo</span>
            )}
          </div>
          <p className="retro text-[9px] leading-relaxed text-foreground">
            {step.detail}
          </p>
          {action ? (
            <HudButton
              type="button"
              size="sm"
              variant={step.disabled ? "outline" : "primary"}
              onClick={action}
              disabled={step.disabled}
              className={cn("w-full justify-center", step.disabled && "opacity-60")}
            >
              {step.label}
            </HudButton>
          ) : (
            <HudButton type="button" size="sm" variant="outline" disabled className="w-full justify-center">
              {step.label}
            </HudButton>
          )}
        </div>

        <ToolJobList jobs={jobs} onOpen={onOpenJob} onOpenArchive={onOpenArchive} />
      </HudWindow>
    </div>
  );
}

export default ToolHudConsole;
