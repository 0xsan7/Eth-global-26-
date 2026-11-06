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
import { readOpportunitiesIndependent, RABDI_PUBLIC_RPC } from "@/lib/arkiv/opportunities-independent";
import { briefmintApi, isApiError } from "@/lib/client/briefmint-api";
import { useBriefs } from "@/lib/client/use-briefs";
import { useSession } from "@/lib/client/use-session";
import type { BriefMintConfig, OpportunityView, PrivateBrief } from "@/lib/shared/briefmint";

const ACTIVE_BRIEF_POLL = new Set(["running", "pending"]);

export default function HomePage() {
  const sessionQ = useSession();
  const address = sessionQ.address;
  const [briefConfig, setBriefConfig] = useState<BriefMintConfig | null>(null);
  const [briefConfigError, setBriefConfigError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityView[]>([]);
  const [oppLoading, setOppLoading] = useState(true);
  const [oppError, setOppError] = useState<string | null>(null);
  const [oppStale, setOppStale] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [building, setBuilding] = useState<BuildingId>("home");
  const [brief, setBrief] = useState<PrivateBrief | null>(null);
  const briefsQ = useBriefs(!!address);
  const briefSummaries = (briefsQ.data?.briefs ?? []).map((b) => ({ id: b.id, title: b.title, category: b.category }));
  const briefsLoading = briefsQ.isLoading;
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const loadOpportunities = useCallback(async (rpcUrl: string) => {
    setOppLoading(true);
    setOppError(null);
    // Prefer the backend list when it is deployed; always fall back to the
    // independent reader so public discovery works without the private API.
    try {
      const res = await briefmintApi.listOpportunities();
      setOpportunities(res.opportunities);
      setOppStale(false);
      setLastRefresh(new Date().toISOString());
      setSelectedKey((prev) => prev ?? res.opportunities.find((o) => o.status === "open")?.entityKey ?? res.opportunities[0]?.entityKey ?? null);
      return;
    } catch {
      // Backend unavailable — independent read below.
    }
    try {
      const list = await readOpportunitiesIndependent({ rpcUrl }, { status: "all" });
      setOpportunities((prev) => {
        if (prev.length > 0) setOppStale(true);
        return list;
      });
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
      let rpc = RABDI_PUBLIC_RPC;
      try {
        const cfg = await briefmintApi.config();
        if (cancelled) return;
        setBriefConfig(cfg);
        if (cfg.arkiv.rpcUrl) rpc = cfg.arkiv.rpcUrl;
      } catch (e) {
        if (cancelled) return;
        setBriefConfigError(
          isApiError(e) && (e.status === 503 || e.code === "SERVICE_UNAVAILABLE")
            ? "BriefMint backend unavailable (503) — public discovery continues via the independent Arkiv reader."
            : "BriefMint config unavailable.",
        );
      }
      await loadOpportunities(rpc);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOpportunities]);

  // Refresh discovery when the window regains focus.
  useEffect(() => {
    const onFocus = () => {
      void loadOpportunities(briefConfig?.arkiv.rpcUrl ?? RABDI_PUBLIC_RPC);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [briefConfig, loadOpportunities]);

  // Account change clears the prior owner's private brief UI state
  // (query caches are cleared by useSessionAccountSync in the provider).
  const prevAddress = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevAddress.current !== undefined && prevAddress.current !== address) {
      setBrief(null);
    }
    prevAddress.current = address;
  }, [address]);

  // Poll the active brief ~2s; reopening a saved brief just loads state.
  useEffect(() => {
    if (!brief || (!ACTIVE_BRIEF_POLL.has(brief.executionStatus) && brief.publication.lastObservedStatus !== "pending")) return;
    const t = setInterval(async () => {
      try {
        setBrief(await briefmintApi.getBrief(brief.id));
      } catch {
        /* keep last known state */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [brief]);

  const handleRun = async () => {
    if (!brief) return;
    setRunBusy(true);
    setRunError(null);
    try {
      const result = await briefmintApi.runBrief(brief.id);
      setBrief(result.brief);
    } catch (e) {
      setRunError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not start compilation. Retry.");
    } finally {
      setRunBusy(false);
    }
  };

  const selectedOpportunity = opportunities.find((o) => o.entityKey === selectedKey) ?? null;
  const scene = briefStateToScene(brief);

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
    if (brief.executionStatus === "ready" && brief.reviewStatus !== "approved")
      return { label: "Review and approve", run: () => setBuilding("treasury") };
    if (brief.publication.lastObservedStatus === "pending") return null;
    if (brief.publication.lastObservedStatus === "live")
      return { label: "View live opportunity", run: () => setBuilding("registry") };
    if (brief.publication.lastObservedStatus === "closed" || brief.publication.lastObservedStatus === "expired")
      return { label: "View in Archive", run: () => setBuilding("archive") };
    if (brief.executionStatus === "ready" && brief.reviewStatus === "approved")
      return { label: "Publish opportunity", run: () => setBuilding("registry") };
    return null;
  })();

  const openCount = opportunities.filter((o) => o.status === "open").length;
  const idleHint =
    brief?.executionStatus === "running"
      ? "Compiling — polling the saved record"
      : brief?.publication.lastObservedStatus === "pending"
        ? "Waiting for on-chain confirmation"
        : "Follow the worker to continue";

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
          ) : briefConfig && !briefConfig.ready ? (
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
        <CityPanel
          building={building}
          briefConfig={briefConfig}
          briefConfigError={briefConfigError}
          brief={brief}
          briefs={briefSummaries}
          briefsLoading={briefsLoading}
          opportunities={opportunities}
          opportunitiesLoading={oppLoading}
          opportunitiesError={oppError}
          opportunitiesStale={oppStale}
          lastRefresh={lastRefresh}
          onRefreshOpportunities={() => void loadOpportunities(briefConfig?.arkiv.rpcUrl ?? RABDI_PUBLIC_RPC)}
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
