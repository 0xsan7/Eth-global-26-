"use client";
// Public opportunities: backend list when deployed, otherwise the independent
// Arkiv reader. Works without a wallet session or the private API.
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/app/AppShell";
import OpportunityBoard from "@/components/briefs/OpportunityBoard";
import OpportunityReader from "@/components/briefs/OpportunityReader";
import { readOpportunitiesIndependent, RABDI_PUBLIC_RPC } from "@/lib/arkiv/opportunities-independent";
import { briefmintApi } from "@/lib/client/briefmint-api";
import type { OpportunityView } from "@/lib/shared/briefmint";

export default function OpportunitiesPage() {
  const [rows, setRows] = useState<OpportunityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selected, setSelected] = useState<OpportunityView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await briefmintApi.listOpportunities();
      setRows(res.opportunities);
      setStale(false);
      setLastRefresh(new Date().toISOString());
      setSelected((prev) => prev ?? res.opportunities[0] ?? null);
      return;
    } catch {
      // fall through to independent reader
    }
    try {
      const list = await readOpportunitiesIndependent({ rpcUrl: RABDI_PUBLIC_RPC }, { status: "all" });
      setRows((prev) => {
        if (prev.length > 0) setStale(true);
        return list;
      });
      setLastRefresh(new Date().toISOString());
      setSelected((prev) => prev ?? list[0] ?? null);
    } catch {
      if (rows.length > 0) {
        setStale(true);
        setError("Arkiv query failed — showing last confirmed list (stale).");
      } else {
        setError("Arkiv query failed. The catalogue could not be refreshed; this does not mean records were withdrawn.");
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      void cancelled;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <AppShell>
      <div className="tc-page">
        <h1>Public opportunities</h1>
        <p className="tc-muted">
          Indexed Arkiv records any application can discover. Reader works without the BriefMint API or a wallet session.
        </p>
        <OpportunityBoard
          opportunities={rows}
          loading={loading}
          error={error}
          lastRefresh={lastRefresh}
          stale={stale}
          onRefresh={load}
          selected={selected}
          onSelect={setSelected}
        />
        <OpportunityReader />
      </div>
    </AppShell>
  );
}
