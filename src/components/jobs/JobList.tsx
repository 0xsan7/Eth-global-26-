"use client";
// JobList: buyer's job summaries, newest first. Detail is fetched on open.
import Link from "next/link";
import type { JobSummary } from "@/lib/shared/domain";

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ready" ? "badge-ready" : status === "interrupted" || status === "failed" ? "badge-bad" : "badge-info";
  return <span className={`badge ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

export default function JobList({ jobs }: { jobs: JobSummary[] }) {
  if (jobs.length === 0) return <p className="tc-muted">No jobs yet. Create a draft from the city to begin.</p>;
  return (
    <ul className="job-list">
      {jobs.map((j) => (
        <li key={j.id}>
          <Link href={`/jobs/${j.id}`}>
            <StatusBadge status={j.status} />
            <span className="tc-mono">{j.id.slice(0, 14)}…</span>
            <span className="tc-muted">
              {j.sourceLang} → {j.targetLang} · updated {new Date(j.updatedAt).toLocaleString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
