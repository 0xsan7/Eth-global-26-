import { Archive, CheckCircle2, FileText, Loader2, Wallet } from "lucide-react";

import type { ToolJob } from "@/lib/tool-city-demo";
import { shortJobId } from "@/lib/tool-city-demo";
import { cn } from "@/lib/utils";

export interface ToolJobListProps {
  jobs: ToolJob[];
  onOpen: (job: ToolJob) => void;
  onOpenArchive: () => void;
}

const STATUS: Record<ToolJob["status"], { label: string; colour: string }> = {
  awaiting_payment: { label: "UNPAID", colour: "text-amber-300" },
  paid: { label: "PAID", colour: "text-sky-300" },
  running: { label: "RUNNING", colour: "text-teal-300" },
  ready: { label: "READY", colour: "text-emerald-300" },
  failed: { label: "FAILED", colour: "text-red-300" },
};

function JobIcon({ status }: { status: ToolJob["status"] }) {
  if (status === "running") {
    return <Loader2 className="size-4 animate-spin text-teal-300" aria-hidden="true" />;
  }
  if (status === "ready") {
    return <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />;
  }
  if (status === "awaiting_payment") {
    return <Wallet className="size-4 text-amber-300" aria-hidden="true" />;
  }
  return <FileText className="size-4 text-sky-300" aria-hidden="true" />;
}

export function ToolJobList({ jobs, onOpen, onOpenArchive }: ToolJobListProps) {
  const ready = jobs.filter((job) => job.status === "ready").length;
  const active = jobs.filter((job) => job.status === "running").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 border-t border-border/50 pt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="hud-label">Jobs</span>
        <div className="flex items-center gap-2">
          {active > 0 ? <span className="hud-pill">{active} running</span> : null}
          {ready > 0 ? <span className="hud-pill">{ready} ready</span> : null}
          <button
            type="button"
            className="retro inline-flex cursor-pointer items-center gap-1 text-[8px] uppercase text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary"
            onClick={onOpenArchive}
            title="Open the Archive"
          >
            <Archive className="size-3" aria-hidden="true" />
            Archive
          </button>
        </div>
      </div>

      <div className="tc-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {jobs.length > 0 ? (
          <div>
            {jobs.map((job) => {
              const status = STATUS[job.status];
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onOpen(job)}
                  className="group grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-border/40 px-1.5 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/10 focus-visible:outline-none"
                >
                  <span className="grid size-6 place-items-center">
                    <JobIcon status={job.status} />
                  </span>
                  <span className="min-w-0">
                    <span className="retro block truncate text-[9px] text-foreground transition-colors group-hover:text-primary">
                      {job.title}
                    </span>
                    <span className="retro flex items-center gap-1 truncate text-[8px] text-muted-foreground">
                      <span className={cn("font-bold", status.colour)}>{status.label}</span>
                      <span aria-hidden="true">·</span>
                      <span>EN→HI</span>
                      <span aria-hidden="true">·</span>
                      <span>{shortJobId(job.id)}</span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="retro text-[8px] text-muted-foreground">{job.costLabel}</span>
                    <span className="retro text-[7px] text-muted-foreground">
                      {job.attemptsUsed} / 2 tries
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="retro px-1 py-4 text-center text-[8px] text-muted-foreground">
            No jobs yet. Draft a source note at Creator&apos;s Home.
          </p>
        )}
      </div>
    </div>
  );
}

export default ToolJobList;
