import { Camera, Languages, Share2 } from "lucide-react";
import { useState } from "react";

import { HudButton } from "./HudButton";
import { HudWindow } from "./HudWindow";
import type { ToolJob } from "@/lib/tool-city-demo";
import { cn } from "@/lib/utils";

export interface ToolHudScanProps {
  job: ToolJob | null;
  running: boolean;
  shared: boolean;
  onShare: () => void;
  onOpenBoard: () => void;
}

export function ToolHudScan({
  job,
  running,
  shared,
  onShare,
  onOpenBoard,
}: ToolHudScanProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <HudWindow
      id="tc-scan"
      title="City scan"
      hint={running ? "working" : "demo"}
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
      className="w-[min(20rem,100%)]"
      meta={
        <span className="hud-pill">
          <span aria-hidden="true" className="hud-dot hud-dot--live" />
          demo city
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="retro truncate text-[9px] text-sky-100/80">
            Share the translation district
          </span>
          <HudButton
            type="button"
            size="sm"
            variant="primary"
            onClick={onShare}
            className="shrink-0"
          >
            {shared ? (
              <Camera className="mr-1 size-3" aria-hidden="true" />
            ) : (
              <Share2 className="mr-1 size-3" aria-hidden="true" />
            )}
            <span className="retro text-[9px]">{shared ? "COPIED" : "SHARE"}</span>
          </HudButton>
        </div>
      }
    >
      <div className="grid gap-2 p-2.5">
        <div className="flex items-baseline gap-2">
          <span className="hud-figure retro">5</span>
          <span className="hud-label flex-1">sites mapped</span>
          <span className="hud-label">1 workshop</span>
        </div>

        {running ? (
          <div className="hud-scanline" aria-label="Private translation running" />
        ) : null}

        <div className="flex flex-wrap gap-1">
          {[
            ["EN→HI", "#f0b35c"],
            ["1 USDT", "#5fd0bd"],
            ["≤250 W", "#8fb8d8"],
            ["PRIVATE", "#d7a6e8"],
          ].map(([label, colour]) => (
            <span
              key={label}
              className="retro inline-flex items-center gap-1 border px-1 py-0.5 text-[8px]"
              style={{
                backgroundColor: `${colour}22`,
                borderColor: `${colour}88`,
                color: colour,
              }}
            >
              {label}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenBoard}
          className={cn(
            "retro flex items-center gap-1.5 border border-border/60 bg-background/30 px-1.5 py-1 text-left text-[8px] text-muted-foreground",
            "transition-colors hover:border-primary/60 hover:text-primary",
          )}
          title="Open the Arkiv workshop listing"
        >
          <Languages className="size-3" aria-hidden="true" />
          <span className="truncate">
            arkiv · tool-city.workshop.v1 ·{" "}
            <span className="text-emerald-300">fresh</span>
          </span>
        </button>

        <p className="retro text-[8px] leading-relaxed text-muted-foreground">
          {job?.status === "running"
            ? "Private model is translating the locked source. Review stays locked until the saved result lands."
            : job?.status === "ready"
              ? "Saved translation is ready. Open the Archive to review, edit or export it."
              : "One merchant, one fixed price, one language pair. The source is split into at most 20 aligned segments."}
        </p>
      </div>
    </HudWindow>
  );
}

export default ToolHudScan;
