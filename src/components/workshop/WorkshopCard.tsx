"use client";
// WorkshopCard: one Arkiv workshop listing with owner, entity key and freshness.
// Never invents a record: renders only the WorkshopView it is given.
import type { WorkshopView } from "@/lib/shared/domain";

interface WorkshopCardProps {
  workshop: WorkshopView;
  selected?: boolean;
  onSelect?: () => void;
}

export function shortKey(key: string): string {
  return key.length > 18 ? `${key.slice(0, 10)}…${key.slice(-8)}` : key;
}

export default function WorkshopCard({ workshop, selected, onSelect }: WorkshopCardProps) {
  const inner = (
    <>
      <strong>{workshop.title}</strong>{" "}
      <span className={`badge ${workshop.freshness === "fresh" ? "badge-fresh" : "badge-stale"}`}>
        {workshop.freshness}
      </span>{" "}
      {!workshop.active && <span className="badge badge-bad">withdrawn</span>}{" "}
      {workshop.supported ? (
        <span className="badge badge-ready">supported</span>
      ) : (
        <span className="badge">unsupported</span>
      )}
      <p className="tc-muted">{workshop.description}</p>
      <dl>
        <div>
          <dt>Owner</dt>
          <dd className="tc-mono">{workshop.ownerAddress}</dd>
        </div>
        <div>
          <dt>Entity key</dt>
          <dd className="tc-mono">{workshop.entityKey}</dd>
        </div>
        <div>
          <dt>Last refresh</dt>
          <dd>{new Date(workshop.fetchedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>
            {workshop.sourceLang} → {workshop.targetLang} · {workshop.jobType}
          </dd>
        </div>
      </dl>
    </>
  );
  if (onSelect) {
    return (
      <button
        type="button"
        className="btn"
        style={{ display: "block", width: "100%", textAlign: "left", margin: "0.4rem 0" }}
        aria-pressed={!!selected}
        onClick={onSelect}
      >
        {inner}
      </button>
    );
  }
  return <div className="card">{inner}</div>;
}
