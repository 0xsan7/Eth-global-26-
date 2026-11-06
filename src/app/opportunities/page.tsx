"use client";
// Public opportunities via the independent Arkiv reader.
// Works without a wallet session or the BriefMint API. An explicit Arkiv
// access key (operator-provided public rate-limit key, never committed)
// enables reads; failures stay distinct from an empty catalogue.
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/app/AppShell";
import OpportunityBoard from "@/components/briefs/OpportunityBoard";
import OpportunityReader from "@/components/briefs/OpportunityReader";
import { readOpportunitiesIndependent } from "@/lib/arkiv/opportunities-independent";
import type { OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";

export default function OpportunitiesPage() {
  const [rows, setRows] = useState<OpportunityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selected, setSelected] = useState<OpportunityView | null>(null);
  const [filters, setFilters] = useState<OpportunityFilters>({ status: "open" });
  const readEpoch = useRef(0);
  const rowCount = useRef(0);

  const load = useCallback(async (f: OpportunityFilters) => {
    const epoch = ++readEpoch.current;
    setLoading(true);
    setError(null);
    try {
      const list = await readOpportunitiesIndependent({ accessKey: "" }, f);
      if (epoch !== readEpoch.current) return;
      rowCount.current = list.length;
      setRows(list);
      setStale(false);
      setLastRefresh(new Date().toISOString());
      setSelected((prev) => list.find((row) => row.entityKey === prev?.entityKey) ?? list[0] ?? null);
    } catch {
      if (epoch !== readEpoch.current) return;
      if (rowCount.current > 0) {
        setStale(true);
        setError("Arkiv query failed, showing last confirmed list (stale).");
      } else {
        setError("Arkiv query failed. The catalogue could not be refreshed; this does not mean records were withdrawn.");
      }
    } finally {
      if (epoch === readEpoch.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load({ status: "open" }); }, 0);
    return () => {
      clearTimeout(timer);
      readEpoch.current += 1;
    };
  }, [load]);

  const handleFilters = useCallback(
    (f: OpportunityFilters) => {
      setFilters(f);
      void load(f);
    },
    [load],
  );

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
          onRefresh={() => load(filters)}
          selected={selected}
          onSelect={setSelected}
          filters={filters}
          onFiltersChange={handleFilters}
        />
        <OpportunityReader />
      </div>
    </AppShell>
  );
}
