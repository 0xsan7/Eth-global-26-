"use client";
// Home: BriefMint city — real opportunity discovery (independent Arkiv reads
// with backend list when available) plus the city and selected-building panel.
// Loading / failed / empty states stay distinct; a failed refresh never proves
// withdrawal, expiry, or deletion.
import { useCallback, useEffect, useRef, useState } from "react";
import NavLinks from "@/components/app/NavLinks";
import WalletControls from "@/components/wallet/WalletControls";
import CityPanel from "@/components/city/CityPanel";
import CityScene from "@/components/city/CityScene";
import { briefStateToScene } from "@/components/city/brief-state-to-scene";
import type { BuildingId } from "@/components/city/scene-config";
import { readOpportunitiesIndependent } from "@/lib/arkiv/opportunities-independent";
import { briefmintApi, isApiError } from "@/lib/client/briefmint-api";
import { useBriefs } from "@/lib/client/use-briefs";
import { useSession } from "@/lib/client/use-session";
import { isCurrentSessionGeneration, currentSessionGeneration } from "@/lib/client/session-generation";
import type { BriefmintConfig, BriefView, OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";

const ACTIVE_BRIEF_POLL = new Set(["running", "pending"]);

export default function HomePage() {
  const sessionQ = useSession();
  const address = sessionQ.address;
  const [briefConfig, setBriefConfig] = useState<BriefmintConfig | null>(null);
  const [briefConfigError, setBriefConfigError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityView[]>([]);
  const [oppLoading, setOppLoading] = useState(true);
  const [oppError, setOppError] = useState<string | null>(null);
  const [oppStale, setOppStale] = useState(false);
  const [oppFilters, setOppFilters] = useState<OpportunityFilters>({ status: "open" });
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [building, setBuilding] = useState<BuildingId>("home");
  const [storedBrief, setBrief] = useState<BriefView | null>(null);
  const brief = address && storedBrief?.ownerAddress.toLowerCase() === address.toLowerCase() ? storedBrief : null;
  const briefsQ = useBriefs(!!address, undefined, address);
  const briefSummaries = briefsQ.data?.briefs ?? [];
  const briefsLoading = briefsQ.isLoading;
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const briefOperationEpoch = useRef(0);
  const previousBriefId = useRef<string | null | undefined>(undefined);

  const loadOpportunities = useCallback(async (filters: OpportunityFilters) => {
    setOppLoading(true);
    setOppError(null);
    // Public discovery runs through the independent Arkiv reader: no backend
    // opportunities endpoint exists in the frozen contract.
    try {
      const list = await readOpportunitiesIndependent({ accessKey: "" }, filters);
      setOpportunities((prev) => {
        if (prev.length > 0) setOppStale(true);
        return list;
      });
      setOppStale(false);
      setLastRefresh(new Date().toISOString());
      setSelectedKey((prev) => prev ?? list.find((o) => o.status === "open")?.entityKey ?? list[0]?.entityKey ?? null);
    } catch {
      if (opportunities.length > 0) {
        setOppStale(true);
        setOppError("Arkiv query failed — showing last confirmed list (stale). This does not mean records were withdrawn.");
      } else {
        setOppError("Arkiv query failed. The catalogue could not be refreshed; this does not mean records were withdrawn or expired.");
      }
    } finally {
      setOppLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await briefmintApi.config();
        if (cancelled) return;
        setBriefConfig(cfg);
      } catch (e) {
        if (cancelled) return;
        setBriefConfigError(
          isApiError(e) && (e.status === 503 || e.code === "SERVICE_UNAVAILABLE")
            ? "BriefMint backend unavailable (503) — public discovery continues via the independent Arkiv reader."
            : "BriefMint config unavailable.",
        );
      }
      await loadOpportunities({ status: "open" });
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOpportunities]);

  // Refresh discovery when the window regains focus.
  useEffect(() => {
    const onFocus = () => {
      void loadOpportunities(oppFilters);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [oppFilters, loadOpportunities]);

  const handleFiltersChange = useCallback(
    (f: OpportunityFilters) => {
      setOppFilters(f);
      void loadOpportunities(f);
    },
    [loadOpportunities],
  );

  // Account change clears the prior owner's private brief UI state
  // (query caches are cleared by useSessionAccountSync in the provider).
  const prevAddress = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevAddress.current !== undefined && prevAddress.current !== address) {
      briefOperationEpoch.current += 1;
      setBrief(null);
      setRunBusy(false);
      setRunError(null);
    }
    prevAddress.current = address;
  }, [address]);

  useEffect(() => {
    if (previousBriefId.current !== undefined && previousBriefId.current !== (brief?.id ?? null)) {
      briefOperationEpoch.current += 1;
    }
    previousBriefId.current = brief?.id ?? null;
  }, [brief?.id]);

  // Poll the active brief ~2s; reopening a saved brief just loads state.
  useEffect(() => {
    if (!brief || (!ACTIVE_BRIEF_POLL.has(brief.executionStatus) && brief.publication.status !== "pending")) return;
    const epoch = briefOperationEpoch.current;
    const id = brief.id;
    const t = setInterval(async () => {
      try {
        const updated = await briefmintApi.getBrief(id, address);
        if (epoch === briefOperationEpoch.current) setBrief(updated);
      } catch {
        /* keep last known state */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [brief, address]);

  const handleRun = async () => {
    if (!brief || !address || brief.ownerAddress.toLowerCase() !== address.toLowerCase()) return;
    const epoch = briefOperationEpoch.current;
    const generation = currentSessionGeneration();
    const id = brief.id;
    setRunBusy(true);
    setRunError(null);
    try {
      const result = await briefmintApi.runBrief(id, address);
      if (epoch === briefOperationEpoch.current && isCurrentSessionGeneration(generation)) setBrief(result.brief);
    } catch (e) {
      if (epoch === briefOperationEpoch.current && isCurrentSessionGeneration(generation)) {
        setRunError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not start compilation. Retry.");
        // A failed dispatched attempt is persisted before its error is returned.
        // Refresh only the brief record so the UI shows the consumed attempt count.
        try {
          const current = await briefmintApi.getBrief(id, address);
          if (epoch === briefOperationEpoch.current && isCurrentSessionGeneration(generation)) setBrief(current);
        } catch { /* Keep the current view if the recovery read is unavailable. */ }
      }
    } finally {
      if (epoch === briefOperationEpoch.current) setRunBusy(false);
    }
  };

  const selectedOpportunity = opportunities.find((o) => o.entityKey === selectedKey) ?? null;
  const scene = briefStateToScene(brief);
  const approved = brief?.review.status === "approved" && brief.review.approval?.draftRevision === brief.draftRevision;

  // The single next action for the bottom bar (existing navigation + run handler only).
  const nextAction: { label: string; run: () => void; busy?: boolean } | null = (() => {
    if (!brief) return { label: "Start a brief", run: () => setBuilding("home") };
    if (brief.executionStatus === "draft") {
      return { label: runBusy ? "Compiling…" : "Compile brief", run: handleRun, busy: runBusy };
    }
    if (brief.executionStatus === "failed" || brief.executionStatus === "interrupted") {
      if (!brief.retryEligible) return null;
      return { label: runBusy ? "Compiling…" : "Retry compilation", run: handleRun, busy: runBusy };
    }
    if (brief.executionStatus === "running") return null;
    if (brief.executionStatus === "ready" && !approved)
      return { label: "Review and approve", run: () => setBuilding("treasury") };
    if (brief.publication.status === "pending") return null;
    if (brief.publication.status === "live")
      return { label: "View live opportunity", run: () => setBuilding("registry") };
    if (brief.publication.status === "closed" || brief.publication.status === "expired")
      return { label: "View in Archive", run: () => setBuilding("archive") };
    if (brief.executionStatus === "ready" && approved)
      return { label: "Publish opportunity", run: () => setBuilding("registry") };
    return null;
  })();

  const openCount = opportunities.filter((o) => o.status === "open").length;
  const idleHint =
    brief?.executionStatus === "running"
      ? "Compiling — polling the saved record"
      : brief?.publication.status === "pending"
        ? "Waiting for on-chain confirmation"
        : "Follow the worker to continue";
  const servicesReady = briefConfig
    ? briefConfig.compilation.available && briefConfig.arkiv.readiness.available && briefConfig.auth.readiness.available
    : null;

  return (
    <div className="city-page">
      <h1 className="sr-only">BriefMint — private notes to public opportunity</h1>
      <CityScene
        selected={building}
        onSelect={setBuilding}
        scene={scene}
        scan={{ opportunities: opportunities.length, open: openCount, loading: oppLoading, stale: oppStale, error: Boolean(oppError) }}
        action={nextAction}
        idleHint={idleHint}
        notice={
          briefConfigError ? (
            <p className="notice notice-warn" role="status">{briefConfigError} Saving, compiling and publishing are unavailable until the backend responds.</p>
          ) : briefConfig && servicesReady === false ? (
            <p className="notice notice-warn" role="status">Some BriefMint services are not ready: intake, compilation or Arkiv may be unavailable.</p>
          ) : null
        }
        consoleTop={
          <div className="console-top">
            <div className="console-title">
              <span className="console-name">BriefMint</span>
              <span className="console-sub">Tool City · private notes → public opportunity</span>
            </div>
            <WalletControls />
            <NavLinks />
          </div>
        }
      >
        <CityPanel key={address ?? "logged-out"}
          building={building}
          brief={brief}
          briefs={briefSummaries}
          briefsLoading={briefsLoading}
          opportunities={opportunities}
          opportunitiesLoading={oppLoading}
          opportunitiesError={oppError}
          opportunitiesStale={oppStale}
          lastRefresh={lastRefresh}
          onRefreshOpportunities={() => void loadOpportunities(oppFilters)}
          oppFilters={oppFilters}
          onOppFiltersChange={handleFiltersChange}
          selectedOpportunity={selectedOpportunity}
          onSelectOpportunity={(o) => setSelectedKey(o.entityKey)}
          onBriefCreated={(b) => { setBrief(b); setBuilding("studio"); }}
          onBriefChange={setBrief}
          onRunBrief={handleRun}
          runBusy={runBusy}
          runError={runError}
        />
      </CityScene>
    </div>
  );
}
