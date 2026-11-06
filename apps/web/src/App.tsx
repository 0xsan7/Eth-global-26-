import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { JobReviewModal } from "@/components/toolcity/JobReviewModal";
import { ToolCityScene } from "@/components/toolcity/ToolCityScene";
import WorkshopBoard from "@/components/toolcity/WorkshopBoard";
import { ToolHudConsole } from "@/components/hud/ToolHudConsole";
import { ToolHudInspector } from "@/components/hud/ToolHudInspector";
import { ToolHudOrder } from "@/components/hud/ToolHudOrder";
import { ToolHudScan } from "@/components/hud/ToolHudScan";
import {
  ARCHIVED_JOB,
  DEMO_SOURCE,
  DEMO_TRANSLATION_SEGMENTS,
  isSourceValid,
  jobTitle,
  splitSegments,
  type BuildingId,
  type ToolJob,
  type TranslationSegment,
} from "@/lib/tool-city-demo";

export interface AppProps {
  onExitToTerminal: () => void;
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return `0x${Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export default function App({ onExitToTerminal }: AppProps) {
  const [selected, setSelected] = useState<BuildingId | null>("home");
  const [source, setSource] = useState(DEMO_SOURCE);
  const [job, setJob] = useState<ToolJob | null>(null);
  const [savedJobs, setSavedJobs] = useState<ToolJob[]>([ARCHIVED_JOB]);
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const shareTimer = useRef<number | null>(null);

  const jobs = useMemo(
    () => (job ? [job, ...savedJobs.filter((saved) => saved.id !== job.id)] : savedJobs),
    [job, savedJobs],
  );
  const reviewJob = useMemo(
    () => jobs.find((candidate) => candidate.id === reviewJobId) ?? null,
    [jobs, reviewJobId],
  );

  useEffect(() => {
    if (job?.status !== "running") return;
    const jobId = job.id;
    const timer = window.setTimeout(() => {
      setJob((current) =>
        current && current.id === jobId && current.status === "running"
          ? {
              ...current,
              status: "ready",
              translation: DEMO_TRANSLATION_SEGMENTS.map((segment) => ({ ...segment })),
              edited: null,
              updatedAt: new Date().toISOString(),
              modelId: "0g-private-translate-v1",
              requestId: `req_0g_${Math.random().toString(16).slice(2, 10)}`,
              routerTeeVerified: true,
            }
          : current,
      );
    }, 1900);
    return () => window.clearTimeout(timer);
  }, [job?.id, job?.status]);

  useEffect(
    () => () => {
      if (shareTimer.current) window.clearTimeout(shareTimer.current);
    },
    [],
  );

  const focusSource = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById("tc-source")?.focus();
    });
  }, []);

  const createJob = useCallback(() => {
    if (!isSourceValid(source)) return;
    const now = new Date().toISOString();
    setJob({
      id: randomHex(32),
      title: jobTitle(source),
      status: "awaiting_payment",
      source,
      sourceSegments: splitSegments(source),
      translation: null,
      edited: null,
      createdAt: now,
      updatedAt: now,
      costLabel: "$1.00",
      txHash: null,
      modelId: null,
      requestId: null,
      routerTeeVerified: null,
      attemptsUsed: 0,
    });
    setSelected("home");
  }, [source]);

  const verifyPayment = useCallback(() => {
    setJob((current) =>
      current?.status === "awaiting_payment"
        ? {
            ...current,
            status: "paid",
            txHash: randomHex(32),
            updatedAt: new Date().toISOString(),
          }
        : current,
    );
    setSelected("treasury");
  }, []);

  const runTranslation = useCallback(() => {
    setJob((current) =>
      current?.status === "paid" || current?.status === "failed"
        ? {
            ...current,
            status: "running",
            attemptsUsed: current.attemptsUsed + 1,
            updatedAt: new Date().toISOString(),
          }
        : current,
    );
    setSelected("studio");
  }, []);

  const newDraft = useCallback(() => {
    setJob(null);
    setReviewJobId(null);
    setSelected("home");
    focusSource();
  }, [focusSource]);

  const openReview = useCallback((target: ToolJob) => {
    if (target.status === "ready") {
      setReviewJobId(target.id);
      setSelected("archive");
      return;
    }
    setSelected(
      target.status === "awaiting_payment"
        ? "treasury"
        : target.status === "paid" || target.status === "running" || target.status === "failed"
          ? "studio"
          : "home",
    );
  }, []);

  const saveEdits = useCallback((segments: TranslationSegment[]) => {
    if (!reviewJob) return;
    if (job?.id === reviewJob.id) {
      setJob((current) =>
        current ? { ...current, edited: segments, updatedAt: new Date().toISOString() } : current,
      );
      return;
    }
    setSavedJobs((current) =>
      current.map((saved) =>
        saved.id === reviewJob.id
          ? { ...saved, edited: segments, updatedAt: new Date().toISOString() }
          : saved,
      ),
    );
  }, [job?.id, reviewJob]);

  const handlePrimary = useCallback(() => {
    if (!job) {
      createJob();
      return;
    }
    if (job.status === "awaiting_payment") {
      setSelected("treasury");
      return;
    }
    if (job.status === "paid" || job.status === "failed") {
      runTranslation();
      return;
    }
    if (job.status === "ready") {
      setReviewJobId(job.id);
      setSelected("archive");
    }
  }, [createJob, job, runTranslation]);

  const handleShare = useCallback(() => {
    void navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    setShared(true);
    if (shareTimer.current) window.clearTimeout(shareTimer.current);
    shareTimer.current = window.setTimeout(() => setShared(false), 1800);
  }, []);

  const workerAt: BuildingId | "plaza" = !job
    ? "plaza"
    : job.status === "awaiting_payment"
      ? "home"
      : job.status === "paid"
        ? "treasury"
        : job.status === "running"
          ? "studio"
          : job.status === "ready"
            ? "archive"
            : "studio";

  return (
    <div className={cn("hud-root", "hud-root--reveal-complete")}>
      <ToolCityScene
        selected={selected}
        onSelect={setSelected}
        workerAt={workerAt}
        busy={job?.status === "running"}
      />

      <div aria-hidden="true" className="hud-vignette" />

      <div className="hud-layer">
        <div className="hud-column hud-column--main">
          <ToolHudScan
            job={job}
            running={job?.status === "running"}
            shared={shared}
            onShare={handleShare}
            onOpenBoard={() => setBoardOpen(true)}
          />

          <div className="flex-1" />

          <ToolHudInspector
            selected={selected}
            job={job}
            draftSource={source}
            onClose={() => setSelected(null)}
            onOpenBoard={() => setBoardOpen(true)}
            onDraft={() => {
              if (job) newDraft();
              setSelected("home");
              focusSource();
            }}
            onVerify={verifyPayment}
            onRun={runTranslation}
            onReview={() => {
              if (job?.status === "ready") setReviewJobId(job.id);
              setSelected("archive");
            }}
          />

          <ToolHudOrder
            source={source}
            onSourceChange={setSource}
            job={job}
            onPrimary={handlePrimary}
            onNewDraft={newDraft}
            onOpenBoard={() => setBoardOpen(true)}
          />
        </div>

        <ToolHudConsole
          jobs={jobs}
          job={job}
          onOpenJob={openReview}
          onOpenArchive={() => setSelected("archive")}
          onOpenBoard={() => setBoardOpen(true)}
          onStartDraft={() => {
            setSelected("home");
            focusSource();
          }}
          onVerify={verifyPayment}
          onRun={runTranslation}
          onReview={() => {
            if (job?.status === "ready") setReviewJobId(job.id);
            setSelected("archive");
          }}
        />
      </div>

      {boardOpen ? (
        <WorkshopBoard
          mode="dialog"
          onClose={() => setBoardOpen(false)}
          onEnter={() => {
            setBoardOpen(false);
            setSelected("registry");
          }}
        />
      ) : null}

      {reviewJob ? (
        <JobReviewModal
          key={reviewJob.id}
          job={reviewJob}
          onClose={() => setReviewJobId(null)}
          onSave={saveEdits}
        />
      ) : null}

      <button
        type="button"
        onClick={onExitToTerminal}
        className="tc-exit-button retro"
        title="Return to the workshop terminal"
      >
        ← terminal
      </button>
    </div>
  );
}
