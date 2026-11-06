"use client";
// Independent opportunity reader — works while the BriefMint API is stopped.
// Takes an explicit RPC URL (no backend session, no cookies). Failed reads
// are distinct from an empty catalogue.
import { useState } from "react";
import { readOpportunitiesIndependent, RABDI_PUBLIC_RPC } from "@/lib/arkiv/opportunities-independent";
import type { BriefCategory, Hex, OpportunityStatus, OpportunityView } from "@/lib/shared/briefmint";

export default function OpportunityReader() {
  const [rpcUrl, setRpcUrl] = useState(RABDI_PUBLIC_RPC);
  const [category, setCategory] = useState<BriefCategory | "all">("all");
  const [status, setStatus] = useState<OpportunityStatus | "all">("open");
  const [rows, setRows] = useState<OpportunityView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityKey, setEntityKey] = useState("");
  const [single, setSingle] = useState<OpportunityView | null>(null);

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const list = await readOpportunitiesIndependent(
        { rpcUrl: rpcUrl.trim() || RABDI_PUBLIC_RPC },
        {
          category: category === "all" ? "all" : category,
          language: "all",
          status: status === "all" ? "all" : status,
          budgetPresent: "all",
        },
      );
      setRows(list);
    } catch {
      setRows(null);
      setError("Independent Arkiv query failed — the reader or RPC is unavailable. This does not prove records were deleted.");
    } finally {
      setBusy(false);
    }
  };

  const readOne = async () => {
    setError(null);
    setSingle(null);
    const key = entityKey.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
      setError("Enter a 32-byte entity key.");
      return;
    }
    setBusy(true);
    try {
      const { readOpportunityIndependent } = await import("@/lib/arkiv/opportunities-independent");
      const row = await readOpportunityIndependent({ rpcUrl: rpcUrl.trim() || RABDI_PUBLIC_RPC }, key as Hex);
      setSingle(row);
      if (!row) setError("No live opportunity record at that key (missing, expired, or different schema).");
    } catch {
      setError("Independent single-record read failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>Independent Arkiv reader (no backend needed)</h3>
      <p className="tc-muted">Queries indexed public records directly. No wallet, no session, no private data.</p>
      <div className="form-field">
        <label htmlFor="reader-rpc">Arkiv RPC URL</label>
        <input id="reader-rpc" type="text" value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} disabled={busy} />
      </div>
      <div className="btn-row">
        <label>Category <select value={category} onChange={(e) => setCategory(e.target.value as BriefCategory | "all")} disabled={busy}><option value="all">All</option><option value="writing">Writing</option><option value="design">Design</option></select></label>
        <label>Status <select value={status} onChange={(e) => setStatus(e.target.value as OpportunityStatus | "all")} disabled={busy}><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select></label>
        <button type="button" className="btn btn-primary" onClick={read} disabled={busy}>{busy ? "Reading…" : "Read opportunities"}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {rows && <p className="tc-muted" role="status">{rows.length === 0 ? "No public records returned (empty catalogue)." : `${rows.length} public record(s) returned.`}</p>}
      {rows && rows.length > 0 && (
        <ul className="job-list">
          {rows.map((o) => (
            <li key={o.entityKey}><span className="badge">{o.category}</span> <span className="badge">{o.status}</span> <strong>{o.title}</strong><br /><span className="tc-mono tc-muted">{o.entityKey} · r{o.revision}</span></li>
          ))}
        </ul>
      )}
      <div className="form-field">
        <label htmlFor="reader-key">Single entity key</label>
        <input id="reader-key" type="text" value={entityKey} onChange={(e) => setEntityKey(e.target.value)} disabled={busy} placeholder="0x…" />
      </div>
      <button type="button" className="btn" onClick={readOne} disabled={busy}>Read single record</button>
      {single && <p className="notice">Found: {single.title} ({single.status}, r{single.revision}) — owner <span className="tc-mono">{single.ownerAddress}</span>.</p>}
    </div>
  );
}
