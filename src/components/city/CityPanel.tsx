"use client";
// CityPanel: detail panel for the selected building.
// Registry → workshop/owner/freshness; Home → draft or review summary;
// Treasury → fixed terms + receipt + checkout; Studio → run/retry + evidence;
// Archive → My Jobs and saved-result access.
import Link from "next/link";
import ToolCityPay from "@/components/checkout/ToolCityPay";
import DraftForm from "@/components/jobs/DraftForm";
import JobEvidence from "@/components/jobs/JobEvidence";
import { StatusBadge } from "@/components/jobs/JobList";
import WorkshopCard from "@/components/workshop/WorkshopCard";
import type { JobView, PublicConfig, WorkshopView } from "@/lib/shared/domain";
import type { BuildingId } from "./scene-config";
import { BUILDING_BY_ID } from "./scene-config";

interface CityPanelProps {
  building: BuildingId;
  config: PublicConfig | null;
  workshops: WorkshopView[];
  workshopLoading: boolean;
  workshopError: string | null;
  lastRefresh: string | null;
  onRefreshWorkshops: () => void;
  selectedWorkshop: WorkshopView | null;
  onSelectWorkshop: (w: WorkshopView) => void;
  job: JobView | null;
  onJobCreated: (job: JobView) => void;
  onJobChange: (job: JobView) => void;
  onRunJob: () => void;
  runBusy: boolean;
  runError: string | null;
}

export default function CityPanel(props: CityPanelProps) {
  const { building, job } = props;
  const def = BUILDING_BY_ID[building];
  return (
    <section className="card city-panel" aria-label={`${def.name} panel`}>
      <h2>{def.name}</h2>
      <p className="tc-muted">{def.description}</p>
      {building === "registry" && <RegistryBody {...props} />}
      {building === "home" && <HomeBody {...props} />}
      {building === "treasury" && <TreasuryBody {...props} />}
      {building === "studio" && <StudioBody {...props} />}
      {building === "archive" && <ArchiveBody job={job} />}
    </section>
  );
}

function RegistryBody(p: CityPanelProps) {
  return (
    <div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={p.onRefreshWorkshops} disabled={p.workshopLoading}>
          {p.workshopLoading ? "Refreshing…" : "Refresh listing"}
        </button>
      </div>
      {p.lastRefresh && <p className="tc-muted">Last successful refresh: {new Date(p.lastRefresh).toLocaleString()}</p>}
      {p.workshopLoading && <p className="tc-muted">Loading workshops from Arkiv…</p>}
      {p.workshopError && !p.workshopLoading && <p className="error" role="alert">{p.workshopError}</p>}
      {!p.workshopLoading && !p.workshopError && p.workshops.length === 0 && (
        <p className="tc-muted">Catalogue is empty — no workshop is currently listed.</p>
      )}
      {p.workshops.map((w) => (
        <WorkshopCard
          key={w.entityKey}
          workshop={w}
          selected={p.selectedWorkshop?.entityKey === w.entityKey}
          onSelect={() => p.onSelectWorkshop(w)}
        />
      ))}
      {p.selectedWorkshop && (
        <p className="notice">Selected workshop: {p.selectedWorkshop.title} — draft at the Creator&apos;s Home.</p>
      )}
    </div>
  );
}

function HomeBody(p: CityPanelProps) {
  if (!p.job) {
    return (
      <DraftForm
        workshopEntityKey={p.selectedWorkshop && p.selectedWorkshop.supported ? p.selectedWorkshop.entityKey : null}
        onCreated={p.onJobCreated}
      />
    );
  }
  return (
    <div>
      <p>
        <StatusBadge status={p.job.status} /> <span className="tc-mono">{p.job.id.slice(0, 18)}…</span>
      </p>
      {p.job.status === "ready" ? (
        <p className="notice">Parcel delivered — review and export it on the job page.</p>
      ) : (
        <p className="tc-muted">Draft accepted and immutable. Follow the worker to continue.</p>
      )}
      <Link className="btn btn-primary" href={`/jobs/${p.job.id}`}>Open job</Link>
    </div>
  );
}

function TreasuryBody(p: CityPanelProps) {
  const terms = p.job?.terms ?? p.config?.terms;
  return (
    <div>
      <h3>Fixed checkout terms</h3>
      {terms ? (
        <dl>
          <div><dt>Chain</dt><dd>{terms.chainId}</dd></div>
          <div><dt>Checkout contract</dt><dd className="tc-mono">{terms.checkoutAddress}</dd></div>
          <div><dt>Token</dt><dd className="tc-mono">{terms.tokenAddress} ({terms.tokenDecimals} decimals)</dd></div>
          <div><dt>Amount (atomic)</dt><dd>{terms.amountAtomic}</dd></div>
          <div><dt>Merchant</dt><dd className="tc-mono">{terms.merchantAddress}</dd></div>
          <div><dt>Service ID</dt><dd className="tc-mono">{terms.serviceId}</dd></div>
          <div><dt>Terms hash</dt><dd className="tc-mono">{terms.termsHash}</dd></div>
        </dl>
      ) : (
        <p className="tc-muted">Checkout not configured — purchasing is disabled until contract reads reconcile.</p>
      )}
      {p.config?.serviceTermsText && (
        <details>
          <summary>Service terms text</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{p.config.serviceTermsText}</p>
        </details>
      )}
      <h3>Receipt</h3>
      {p.job?.payment ? (
        <dl>
          <div><dt>Transaction</dt><dd className="tc-mono">{p.job.payment.txHash}</dd></div>
          <div><dt>Status</dt><dd>{p.job.payment.status}</dd></div>
          <div><dt>Verified at</dt><dd>{p.job.payment.verifiedAt ?? "pending"}</dd></div>
        </dl>
      ) : (
        <p className="tc-muted">{p.job ? "No payment submitted yet." : "Create a draft at the Creator's Home first."}</p>
      )}
      {p.job && <ToolCityPay job={p.job} onJobChange={p.onJobChange} />}
    </div>
  );
}

function StudioBody(p: CityPanelProps) {
  const { job } = p;
  if (!job) return <p className="tc-muted">No job yet — the Studio works on paid jobs only.</p>;
  const canStart = job.status === "paid";
  return (
    <div>
      <p><StatusBadge status={job.status} /> attempts used: {job.attemptsUsed}</p>
      {job.error && <p className="error" role="alert">{job.error.code}: {job.error.message}</p>}
      {p.runError && <p className="error" role="alert">{p.runError}</p>}
      {(canStart || job.retryEligible) && (
        <button type="button" className="btn btn-primary" disabled={p.runBusy} onClick={p.onRunJob}>
          {p.runBusy ? "Working…" : canStart ? "Start translation" : "Retry translation"}
        </button>
      )}
      <Link className="btn" href={`/jobs/${job.id}`}>Open full review</Link>
      <JobEvidence job={job} />
    </div>
  );
}

function ArchiveBody({ job }: { job: JobView | null }) {
  return (
    <div>
      <p className="tc-muted">Saved results live under your authenticated job records.</p>
      <div className="btn-row">
        <Link className="btn btn-primary" href="/jobs">My Jobs</Link>
        {job && <Link className="btn" href={`/jobs/${job.id}`}>Current job</Link>}
        <Link className="btn" href="/merchant">Merchant console</Link>
      </div>
    </div>
  );
}
