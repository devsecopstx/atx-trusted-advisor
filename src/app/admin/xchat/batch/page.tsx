import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import {
  buildBatchDashboardSummary,
  toBatchDashboardJob
} from "@/modules/xchat/batch-dashboard";
import { listBatchJobs } from "@/modules/xchat/batch-service";

export default async function AdminXchatBatchPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/xchat");
  }

  const jobs = await listBatchJobs({
    tenantId: session.tenantId,
    limit: 50
  });
  const dashboardJobs = jobs.map((job) => toBatchDashboardJob(job));
  const summary = buildBatchDashboardSummary(dashboardJobs);

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">xfinance core admin</p>
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
          <p>Initial shell view; detail drilldowns and filters come next.</p>
        </div>
        {dashboardJobs.length === 0 ? (
          <p className="status-text">No batch jobs yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table-grid">
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
                      <code>{job.xaiBatchId}</code>
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
