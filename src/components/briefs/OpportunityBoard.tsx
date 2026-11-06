"use client";
// Registry: real Arkiv opportunities through indexed queries.
// Failed reads stay distinct from an empty catalogue; a failed refresh never
// proves withdrawal or expiry. Closed records remain readable until expiry
// but are excluded from the default open view.
import { useState } from "react";
import type { BriefCategory, OpportunityStatus, OpportunityView } from "@/lib/shared/briefmint";
import { filterOpportunities } from "@/lib/shared/briefmint-validation";

interface OpportunityBoardProps {
  opportunities: OpportunityView[];
  loading: boolean;
  error: string | null;
  lastRefresh: string | null;
  stale: boolean;
  onRefresh: () => void;
  selected: OpportunityView | null;
  onSelect: (o: OpportunityView) => void;
}

export function shortKey(key: string): string {
  return key.length > 14 ? `${key.slice(0, 8)}…${key.slice(-4)}` : key;
}

export default function OpportunityBoard(p: OpportunityBoardProps) {
  const [category, setCategory] = useState<BriefCategory | "all">("all");
  const [status, setStatus] = useState<OpportunityStatus | "all">("open");
  const [budget, setBudget] = useState<"all" | "with" | "without">("all");
  const [query, setQuery] = useState("");

  const visible = filterOpportunities(p.opportunities, {
    category: category === "all" ? "all" : category,
    status: status === "all" ? "all" : status,
    budgetPresent: budget,
    query,
  });

  return (
    <div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={p.onRefresh} disabled={p.loading}>
          {p.loading ? "Refreshing…" : "Refresh opportunities"}
        </button>
        <label>
          Category{" "}
          <select value={category} onChange={(e) => setCategory(e.target.value as BriefCategory | "all")}>
            <option value="all">All</option>
            <option value="writing">Writing</option>
            <option value="design">Design</option>
          </select>
        </label>
        <label>
          Status{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value as OpportunityStatus | "all")}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Budget{" "}
          <select value={budget} onChange={(e) => setBudget(e.target.value as "all" | "with" | "without")}>
            <option value="all">All</option>
            <option value="with">Advertised</option>
            <option value="without">Not advertised</option>
          </select>
        </label>
      </div>
      <div className="form-field">
        <label htmlFor="opp-query">Search title/summary</label>
        <input id="opp-query" type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. launch graphics" />
      </div>
      {p.lastRefresh && <p className="tc-muted">Last successful refresh: {new Date(p.lastRefresh).toLocaleString()}</p>}
      {p.stale && !p.loading && <p className="notice" role="status">Showing last confirmed list (stale) — the catalogue could not be refreshed.</p>}
      {p.loading && <p className="tc-muted">Querying Arkiv indexed records…</p>}
      {p.error && !p.loading && <p className="error" role="alert">{p.error}</p>}
      {!p.loading && !p.error && p.opportunities.length === 0 && (
        <p className="tc-muted">No opportunities published yet — the public catalogue is empty (not an error).</p>
      )}
      {!p.loading && !p.error && p.opportunities.length > 0 && visible.length === 0 && (
        <p className="tc-muted">No records match the current filters.</p>
      )}
      <ul className="job-list">
        {visible.map((o) => (
          <li key={o.entityKey}>
            <button
              type="button"
              onClick={() => p.onSelect(o)}
              aria-pressed={p.selected?.entityKey === o.entityKey}
              style={{ all: "unset", cursor: "pointer", width: "100%" }}
            >
              <span className="badge">{o.category}</span>{" "}
              <span className={o.status === "open" ? "badge badge-fresh" : "badge badge-stale"}>{o.status}</span>{" "}
              <strong>{o.title}</strong>
              <br />
              <span className="tc-muted">{o.summary.slice(0, 140)}</span>
              <br />
              <span className="tc-mono tc-muted">
                {shortKey(o.entityKey)} · r{o.revision} · {o.budgetCents === null ? "no advertised budget" : `$${(o.budgetCents / 100).toFixed(2)} (unfunded)`} · deadline {o.deadline}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {p.selected && (
        <div className="card">
          <h3>Selected opportunity</h3>
          <dl>
            <div><dt>Title</dt><dd>{p.selected.title}</dd></div>
            <div><dt>Owner</dt><dd className="tc-mono">{p.selected.ownerAddress}</dd></div>
            <div><dt>Entity key</dt><dd className="tc-mono">{p.selected.entityKey}</dd></div>
            <div><dt>Revision / status</dt><dd>r{p.selected.revision} · {p.selected.status} · {p.selected.freshness}</dd></div>
            <div><dt>Deadline</dt><dd className="tc-mono">{p.selected.deadline}</dd></div>
            <div><dt>Contact</dt><dd className="tc-mono">{p.selected.contactUrl ?? "none"}</dd></div>
            <div><dt>Expires at block</dt><dd className="tc-mono">{p.selected.expiresAtBlock ?? "not reported"}</dd></div>
          </dl>
          <p className="tc-muted">Anyone may reuse the namespace tag; only the actual owner address above can mutate this record. Content renders as untrusted text.</p>
        </div>
      )}
    </div>
  );
}
