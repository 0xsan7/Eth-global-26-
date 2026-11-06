"use client";
// Registry: real Arkiv opportunities through indexed queries.
// Failed reads stay distinct from an empty catalogue; a failed refresh never
// proves withdrawal or expiry. Closed records remain readable until expiry.
// Text search filters client-side after the indexed fetch; category, status
// and budget presence filter server-side through indexed fields.
import { useState } from "react";
import type { OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";
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
  filters: OpportunityFilters;
  onFiltersChange: (f: OpportunityFilters) => void;
}

export function shortKey(key: string): string {
  return key.length > 14 ? `${key.slice(0, 8)}…${key.slice(-4)}` : key;
}

export default function OpportunityBoard(p: OpportunityBoardProps) {
  const [query, setQuery] = useState("");
  const f = p.filters;

  const visible = filterOpportunities(p.opportunities, { ...f, query });
  const setFilter = (patch: Partial<OpportunityFilters>) => p.onFiltersChange({ ...f, ...patch });

  return (
    <div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={p.onRefresh} disabled={p.loading}>
          {p.loading ? "Refreshing…" : "Refresh opportunities"}
        </button>
        <label>
          Category{" "}
          <select value={f.category ?? "all"} onChange={(e) => setFilter({ category: e.target.value as OpportunityFilters["category"] })}>
            <option value="all">All</option>
            <option value="writing">Writing</option>
            <option value="design">Design</option>
          </select>
        </label>
        <label>
          Status{" "}
          <select value={f.status ?? "open"} onChange={(e) => setFilter({ status: e.target.value as OpportunityFilters["status"] })}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Budget{" "}
          <select value={f.budget ?? "all"} onChange={(e) => setFilter({ budget: e.target.value as OpportunityFilters["budget"] })}>
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
                {shortKey(o.entityKey)} · r{o.revision} · {o.budgetUsdCents === null ? "no advertised budget (unfunded)" : `$${(o.budgetUsdCents / 100).toFixed(2)} (unfunded)`} · deadline {o.deadline}
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
            <div><dt>Summary</dt><dd>{p.selected.summary}</dd></div>
            <div><dt>Owner</dt><dd className="tc-mono">{p.selected.ownerAddress}</dd></div>
            <div><dt>Entity key</dt><dd className="tc-mono">{p.selected.entityKey}</dd></div>
            <div><dt>Revision / status</dt><dd>r{p.selected.revision} · {p.selected.status} · {p.selected.freshness}</dd></div>
            <div><dt>Deadline</dt><dd className="tc-mono">{p.selected.deadline}</dd></div>
            <div><dt>Contact</dt><dd className="tc-mono">{p.selected.contactUrl ?? "none"}</dd></div>
            <div><dt>Expires at block</dt><dd className="tc-mono">{p.selected.expiresAtBlock ?? "not reported"}</dd></div>
          </dl>
          {([
            ["deliverables", "Deliverables"],
            ["acceptanceCriteria", "Acceptance criteria"],
            ["exclusions", "Exclusions"],
            ["openQuestions", "Open questions"],
          ] as const).map(([key, label]) => (
            <section key={key}>
              <h4>{label}</h4>
              {p.selected![key].length > 0
                ? <ul>{p.selected![key].map((text, index) => <li key={index}>{text}</li>)}</ul>
                : <p className="tc-muted">None listed.</p>}
            </section>
          ))}
          <p className="tc-muted">Anyone may reuse the namespace tag; only the actual owner address above can mutate this record. Content renders as untrusted text.</p>
        </div>
      )}
    </div>
  );
}
