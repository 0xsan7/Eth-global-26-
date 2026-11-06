"use client";
// CityPanel: detail panel for the selected building, BriefMint workflow.
// Registry → indexed opportunities + owner publication; Home (Planning Desk id)
// → private intake; Release Desk (treasury id) → exact preview + approval;
// Studio → compilation; Archive → persisted briefs. Geometry and styling unchanged.
import Link from "next/link";
import BriefEvidence from "@/components/briefs/BriefEvidence";
import BriefIntakeForm from "@/components/briefs/BriefIntakeForm";
import BriefList from "@/components/briefs/BriefList";
import OpportunityBoard from "@/components/briefs/OpportunityBoard";
import OpportunityPublisher from "@/components/briefs/OpportunityPublisher";
import OpportunityReader from "@/components/briefs/OpportunityReader";
import ReleaseDesk from "@/components/briefs/ReleaseDesk";
import type { BriefSummary, BriefView, OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";
import type { BuildingId } from "./scene-config";
import { BUILDING_BY_ID } from "./scene-config";

interface CityPanelProps {
  building: BuildingId;
  brief: BriefView | null;
  briefs: BriefSummary[];
  briefsLoading: boolean;
  opportunities: OpportunityView[];
  opportunitiesLoading: boolean;
  opportunitiesError: string | null;
  opportunitiesStale: boolean;
  lastRefresh: string | null;
  onRefreshOpportunities: () => void;
  oppFilters: OpportunityFilters;
  onOppFiltersChange: (f: OpportunityFilters) => void;
  selectedOpportunity: OpportunityView | null;
  onSelectOpportunity: (o: OpportunityView) => void;
  onBriefCreated: (b: BriefView) => void;
  onBriefChange: (b: BriefView) => void;
  onRunBrief: () => void;
  runBusy: boolean;
  runError: string | null;
}

export default function CityPanel(props: CityPanelProps) {
  const { building } = props;
  const def = BUILDING_BY_ID[building];
  return (
    <section className="hud-panel" aria-label={`${def.name} panel`}>
      <h2 className="hud-panel-title">{def.name}</h2>
      <p className="hud-muted">{def.description}</p>
      {building === "registry" && <RegistryBody {...props} />}
      {building === "home" && <HomeBody {...props} />}
      {building === "treasury" && <ReleaseBody {...props} />}
      {building === "studio" && <StudioBody {...props} />}
      {building === "archive" && <ArchiveBody {...props} />}
    </section>
  );
}

function RegistryBody(p: CityPanelProps) {
  return (
    <div>
      <OpportunityBoard
        opportunities={p.opportunities}
        loading={p.opportunitiesLoading}
        error={p.opportunitiesError}
        lastRefresh={p.lastRefresh}
        stale={p.opportunitiesStale}
        onRefresh={p.onRefreshOpportunities}
        selected={p.selectedOpportunity}
        onSelect={p.onSelectOpportunity}
        filters={p.oppFilters}
        onFiltersChange={p.onOppFiltersChange}
      />
      <OpportunityPublisher brief={p.brief} onSaved={p.onBriefChange} rpcLabel="Rabdi 7794095" />
      <OpportunityReader />
    </div>
  );
}

function HomeBody(p: CityPanelProps) {
  if (!p.brief) {
    return <BriefIntakeForm onCreated={p.onBriefCreated} />;
  }
  return (
    <div>
      <p>
        <span className="badge badge-info">{p.brief.executionStatus}</span>{" "}
        <span className="tc-mono">{p.brief.id.slice(0, 18)}…</span>
      </p>
      <p className="tc-muted">
        {p.brief.publicParameters.title}, r{p.brief.draftRevision} · {p.brief.review.status}
      </p>
      <Link className="btn btn-primary" href={`/briefs/${p.brief.id}`}>Open brief</Link>
    </div>
  );
}

function ReleaseBody(p: CityPanelProps) {
  return (
    <div>
      <ReleaseDesk key={p.brief ? `${p.brief.id}:${p.brief.draftRevision}` : "none"} brief={p.brief} onSaved={p.onBriefChange} />
      {p.brief && (
        <p className="tc-muted">
          <Link href={`/briefs/${p.brief.id}`}>Full brief detail →</Link>
        </p>
      )}
    </div>
  );
}

function StudioBody(p: CityPanelProps) {
  const { brief } = p;
  if (!brief) return <p className="tc-muted">No brief yet, save private notes at the Creator&apos;s Home first.</p>;
  const canStart = brief.executionStatus === "draft" || (brief.executionStatus === "failed" && brief.retryEligible);
  return (
    <div>
      <p><span className="badge badge-info">{brief.executionStatus}</span> attempts used: {brief.attemptsUsed}</p>
      {brief.error && <p className="error" role="alert">{brief.error.code}: {brief.error.message}</p>}
      {p.runError && <p className="error" role="alert">{p.runError}</p>}
      {(canStart || brief.retryEligible) && (
        <button type="button" className="btn btn-primary" disabled={p.runBusy} onClick={p.onRunBrief}>
          {p.runBusy ? "Working…" : brief.executionStatus === "draft" ? "Start compilation" : "Retry compilation"}
        </button>
      )}
      <Link className="btn" href={`/briefs/${brief.id}`}>Open full review</Link>
      <BriefEvidence brief={brief} />
    </div>
  );
}

function ArchiveBody(p: CityPanelProps) {
  return (
    <div>
      <p className="tc-muted">Owner-authenticated private briefs. Reopening loads saved content, never recompiles.</p>
      <div className="btn-row">
        <Link className="btn btn-primary" href="/briefs">My Briefs</Link>
        {p.brief && <Link className="btn" href={`/briefs/${p.brief.id}`}>Current brief</Link>}
        <Link className="btn" href="/opportunities">Public opportunities</Link>
      </div>
      {p.briefsLoading ? (
        <p className="tc-muted">Loading briefs…</p>
      ) : (
        <BriefList briefs={p.briefs} />
      )}
    </div>
  );
}
