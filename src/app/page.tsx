"use client";
// Home: real workshop discovery (Arkiv read after /api/config), the city,
// and the selected-building panel. Loading / failed / empty catalogue states
// stay distinct; a failed refresh never proves withdrawal or expiry.
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/app/AppShell";
import CityPanel from "@/components/city/CityPanel";
import CityScene from "@/components/city/CityScene";
import { jobStateToScene } from "@/components/city/job-state-to-scene";
import type { BuildingId } from "@/components/city/scene-config";
import WorkshopCard from "@/components/workshop/WorkshopCard";
import { listWorkshops } from "@/lib/arkiv/read";
import { api, isApiError } from "@/lib/client/api-client";
import { useSession } from "@/lib/client/use-session";
import type { JobView, PublicConfig, WorkshopView } from "@/lib/shared/domain";
import { DEV_FIXTURE_WORKSHOP, devFixturesEnabled } from "@/lib/shared/fixtures";

const ACTIVE_POLL = new Set(["payment_pending", "paid", "running"]);

export default function HomePage() {
  const sessionQ = useSession();
  const address = sessionQ.address;
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [workshops, setWorkshops] = useState<WorkshopView[]>([]);
  const [workshopLoading, setWorkshopLoading] = useState(true);
  const [workshopError, setWorkshopError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [building, setBuilding] = useState<BuildingId>("registry");
  const [job, setJob] = useState<JobView | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const loadWorkshops = useCallback(async (cfg: PublicConfig) => {
    setWorkshopLoading(true);
    setWorkshopError(null);
    try {
      const list = await listWorkshops(cfg);
      setWorkshops(list);
      setLastRefresh(new Date().toISOString());
      setSelectedKey((prev) => prev ?? list.find((w) => w.supported && w.active)?.entityKey ?? list[0]?.entityKey ?? null);
    } catch {
      // Failed refresh does not prove withdrawal or expiry — keep old list.
      setWorkshopError("Arkiv query failed. The catalogue could not be refreshed; this does not mean listings were withdrawn.");
    } finally {
      setWorkshopLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.config();
        if (cancelled) return;
        setConfig(cfg);
        await loadWorkshops(cfg);
      } catch (e) {
        if (cancelled) return;
        setConfigError(isApiError(e) ? `${e.code}: ${e.message}` : "Config unavailable.");
        setWorkshopLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadWorkshops]);

  // Refresh discovery when the window regains focus.
  useEffect(() => {
    const onFocus = () => { if (config) void loadWorkshops(config); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [config, loadWorkshops]);

  // Account change clears the prior buyer's private job UI state
  // (query caches are cleared by useSessionAccountSync in the provider).
  const prevAddress = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevAddress.current !== undefined && prevAddress.current !== address) setJob(null);
    prevAddress.current = address;
  }, [address]);

  // Poll the active job ~2s; reopening a finished job just loads saved state.
  useEffect(() => {
    if (!job || !ACTIVE_POLL.has(job.status)) return;
    const t = setInterval(async () => {
      try {
        setJob(await api.getJob(job.id));
      } catch { /* keep last known state */ }
    }, 2000);
    return () => clearInterval(t);
  }, [job]);

  const handleRun = async () => {
    if (!job) return;
    setRunBusy(true);
    setRunError(null);
    try {
      const result = await api.runJob(job.id);
      setJob(result.job);
    } catch (e) {
      setRunError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not start the run. Retry.");
    } finally {
      setRunBusy(false);
    }
  };

  const selectedWorkshop = workshops.find((w) => w.entityKey === selectedKey) ?? null;
  const scene = jobStateToScene(job);
  const showFixture = devFixturesEnabled() && !workshopLoading && (workshopError !== null || workshops.length === 0);

  return (
    <AppShell>
      <div className="tc-page">
        <h1>Tool City — private translation workshop</h1>
        <p className="tc-muted">
          Discover the merchant-owned workshop, draft English text, purchase the job, and review the Hindi
          translation. One merchant, one fixed test-USDT price.
        </p>
        {configError && <p className="error" role="alert">{configError}</p>}
        {config && !config.configured && (
          <p className="notice">Checkout is not configured yet — purchasing stays disabled until contract reads reconcile.</p>
        )}
        <div className="city-layout">
          <CityScene selected={building} onSelect={setBuilding} scene={scene} jobStatusLabel={job?.status ?? null} />
          <CityPanel
            building={building}
            config={config}
            workshops={workshops}
            workshopLoading={workshopLoading}
            workshopError={workshopError}
            lastRefresh={lastRefresh}
            onRefreshWorkshops={() => { if (config) void loadWorkshops(config); }}
            selectedWorkshop={selectedWorkshop}
            onSelectWorkshop={(w) => setSelectedKey(w.entityKey)}
            job={job}
            onJobCreated={(j) => { setJob(j); setBuilding("treasury"); }}
            onJobChange={setJob}
            onRunJob={handleRun}
            runBusy={runBusy}
            runError={runError}
          />
        </div>
        {showFixture && (
          <div className="card">
            <h2>Development fixture (not live)</h2>
            <p className="tc-muted">Shown only because NEXT_PUBLIC_ENABLE_DEV_FIXTURES is set. Never a live listing.</p>
            <WorkshopCard workshop={DEV_FIXTURE_WORKSHOP} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
