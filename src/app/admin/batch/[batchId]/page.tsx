import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { BatchDetailPolling } from "./batch-detail-polling";
import { toBatchDashboardJob } from "@/modules/xchat/batch-dashboard";
import {
  getBatchJobRecord,
  listBatchItemResults
} from "@/modules/xchat/batch-service";

type AdminBatchDetailPageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function AdminBatchDetailPage({
  params
}: AdminBatchDetailPageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/xchat");
  }

  const { batchId } = await params;
  const job = await getBatchJobRecord(batchId);
  if (!job) {
    return (
      <div className="core-shell">
        <section className="panel stack-gap">
          <h1>Batch Not Found</h1>
          <p className="status-text">No batch exists for id: {batchId}</p>
          <Link className="admin-function-card" href="/admin/xchat/batch">
            <span className="admin-function-copy">
              <strong>Back to Batch Ops</strong>
              <span>Return to dashboard.</span>
            </span>
          </Link>
        </section>
      </div>
    );
  }

  const items = await listBatchItemResults(batchId);
  const lastError =
    items.find((item) => item.status === "failed" && item.errorMessage)?.errorMessage ?? null;
  const dashboard = toBatchDashboardJob(job, lastError);

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Batch Detail</h1>
        <p className="hero-copy">
          Drilldown for <code>{job.xaiBatchId}</code> with progress and item-level results.
        </p>
      </section>

      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Job Summary</h2>
        </div>
        <div className="admin-function-grid">
          <article className="admin-function-card">
            <span className="admin-function-copy">
              <strong>Status</strong>
              <span>{dashboard.status}</span>
            </span>
          </article>
          <article className="admin-function-card">
            <span className="admin-function-copy">
              <strong>Completion</strong>
              <span>{dashboard.completionPct}%</span>
            </span>
          </article>
          <article className="admin-function-card">
            <span className="admin-function-copy">
              <strong>Items</strong>
              <span>{dashboard.itemCount}</span>
            </span>
          </article>
          <article className="admin-function-card">
            <span className="admin-function-copy">
              <strong>Failed</strong>
              <span>{dashboard.failedCount}</span>
            </span>
          </article>
        </div>
        {dashboard.lastError ? (
          <p className="status-text status-error">Last error: {dashboard.lastError}</p>
        ) : null}
        {!dashboard.isTerminal ? (
          <BatchDetailPolling batchId={batchId} isTerminal={dashboard.isTerminal} />
        ) : null}
      </section>

      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Item Results</h2>
          <p>Showing {items.length} items for this batch.</p>
        </div>
        {items.length === 0 ? (
          <p className="status-text">No batch items found.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Item ID</th>
                  <th>Status</th>
                  <th>xAI State</th>
                  <th>Scope</th>
                  <th>Message</th>
                  <th>xAI Error</th>
                  <th>Response / Error</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.itemId}>
                    <td>
                      <code>{item.itemId}</code>
                    </td>
                    <td>{item.status}</td>
                    <td>{item.xaiRequestState ?? "-"}</td>
                    <td>{item.scope}</td>
                    <td>{item.message}</td>
                    <td>{item.xaiErrorCode ?? "-"}</td>
                    <td>{item.responseText ?? item.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel stack-gap">
        <Link className="admin-function-card" href="/admin/xchat/batch">
          <span className="admin-function-copy">
            <strong>Back to Batch Ops</strong>
            <span>Return to dashboard list and filters.</span>
          </span>
        </Link>
      </section>
    </div>
  );
}
