import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import {
  buildBatchDashboardSummary,
  toBatchDashboardJob
} from "@/modules/xchat/batch-dashboard";
import { listBatchJobs } from "@/modules/xchat/batch-service";

type AdminXchatBatchPageProps = {
  searchParams: Promise<{
    status?: string;
    q?: string;
  }>;
};

export default async function AdminXchatBatchPage({
  searchParams
}: AdminXchatBatchPageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/xchat");
  }
  const params = await searchParams;
  const statusFilter = (params.status ?? "all").trim().toLowerCase();
  const query = (params.q ?? "").trim().toLowerCase();

  const jobs = await listBatchJobs({
    tenantId: session.tenantId,
    limit: 50
  });
  const allDashboardJobs = jobs.map((job) => toBatchDashboardJob(job));
  const dashboardJobs = allDashboardJobs.filter((job) => {
    const statusMatch =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? !job.isTerminal
          : job.status.toLowerCase() === statusFilter;
    const queryMatch =
      query.length === 0
        ? true
        : job.xaiBatchId.toLowerCase().includes(query) ||
          job.personaName.toLowerCase().includes(query) ||
          job.submittedBy.toLowerCase().includes(query);
    return statusMatch && queryMatch;
  });
  const summary = buildBatchDashboardSummary(dashboardJobs);

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Batch Operations Dashboard</h1>
        <p className="hero-copy">
          Operational snapshot for xChat batch runs with status totals and per-job progress.
        </p>
      </section>

      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Overview</h2>
          <p>Read-model summary from batch jobs in this tenant.</p>
        </div>
        <div className="admin-function-grid">
          <article className="admin-function-card">
            <span className="admin-function-copy">
              <strong>Active Jobs</strong>
              <span>{summary.activeJobs}</span>
            </span>
          </article>
          <article className="admin-function-card">
            <span className="admin-function-copy">
              <strong>Failed Jobs</strong>
              <span>{summary.failedJobs}</span>
            </span>
          </article>
          <article className="admin-function-card">
            <span className="admin-function-copy">
              <strong>Completion</strong>
              <span>{summary.completionPct}%</span>
            </span>
          </article>
          <article className="admin-function-card">
            <span className="admin-function-copy">
              <strong>Failed Items</strong>
              <span>{summary.failedItems}</span>
            </span>
          </article>
        </div>
      </section>

      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Recent Jobs</h2>
          <p>Filter by status/query and open per-batch detail drilldowns.</p>
        </div>
        <form className="admin-function-grid" method="GET">
          <label className="admin-function-copy">
            <strong>Status</strong>
            <select defaultValue={statusFilter} name="status">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="admin-function-copy">
            <strong>Search</strong>
            <input
              defaultValue={params.q ?? ""}
              name="q"
              placeholder="batch id, persona, or submitter"
              type="text"
            />
          </label>
          <button type="submit">Apply Filters</button>
        </form>
        {dashboardJobs.length === 0 ? (
          <p className="status-text">No batch jobs yet.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Persona</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Done</th>
                  <th>Failed</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {dashboardJobs.map((job) => (
                  <tr key={job.xaiBatchId}>
                    <td>
                      <Link href={`/admin/xchat/batch/${job.xaiBatchId}`}>
                        <code>{job.xaiBatchId}</code>
                      </Link>
                    </td>
                    <td>{job.personaName}</td>
                    <td>{job.status}</td>
                    <td>{job.itemCount}</td>
                    <td>{job.completedCount}</td>
                    <td>{job.failedCount}</td>
                    <td>{job.pendingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel stack-gap">
        <Link className="admin-function-card" href="/admin/xchat">
          <span className="admin-function-copy">
            <strong>Back to xChat Ask</strong>
            <span>Return to interactive single-message xChat testing.</span>
          </span>
        </Link>
      </section>
    </div>
  );
}
