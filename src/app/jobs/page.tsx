"use client";
// My Jobs: authenticated buyer summaries via GET /api/jobs. 401 → login prompt.
import AppShell from "@/components/app/AppShell";
import JobList from "@/components/jobs/JobList";
import { isApiError } from "@/lib/client/api-client";
import { useJobsList } from "@/lib/client/use-job";
import { useSession } from "@/lib/client/use-session";

export default function JobsPage() {
  const sessionQ = useSession();
  const address = sessionQ.address;
  const jobsQ = useJobsList(!!address);

  let body: React.ReactNode;
  if (sessionQ.loading) {
    body = <p className="tc-muted">Checking session…</p>;
  } else if (!address) {
    body = <p className="notice">Connect your wallet and sign in to see your jobs.</p>;
  } else if (jobsQ.isLoading) {
    body = <p className="tc-muted">Loading jobs…</p>;
  } else if (jobsQ.error) {
    body = isApiError(jobsQ.error) && jobsQ.error.status === 401 ? (
      <p className="notice">Connect your wallet and sign in to see your jobs.</p>
    ) : (
      <p className="error" role="alert">
        {isApiError(jobsQ.error) ? `${jobsQ.error.code}: ${jobsQ.error.message}` : "Could not load jobs."}
      </p>
    );
  } else {
    body = <JobList jobs={jobsQ.data ?? []} />;
  }

  return (
    <AppShell>
      <div className="tc-page">
        <h1>My Jobs</h1>
        {body}
      </div>
    </AppShell>
  );
}
