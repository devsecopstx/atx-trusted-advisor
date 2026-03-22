import { getAdminXchatToolUsageSummary } from "@/modules/xchat/tool-usage-repository";

export default async function AdminXchatToolUsagePage() {
  const summary = await getAdminXchatToolUsageSummary({ windowDays: 7, recentLimit: 60 });

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h2>xChat tool usage</h2>
        <p className="status-text">
          Fire-and-forget writes from <code>/api/xchat/ask</code> (MongoDB collection{" "}
          <code>xchat_tool_usage</code>). Last {summary.windowDays} days since {summary.sinceIso}.
        </p>
        <p className="status-text">
          <strong>Total calls:</strong> {summary.totalCalls}
        </p>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>By tool ({summary.windowDays}d)</h3>
        {summary.byTool.length === 0 ? (
          <p className="status-text">No rows yet — use xChat with tools enabled.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Calls</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {summary.byTool.map((row) => (
                  <tr key={row.toolName}>
                    <td>
                      <code>{row.toolName}</code>
                    </td>
                    <td>{row.count}</td>
                    <td>{row.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Recent calls</h3>
        {summary.recent.length === 0 ? (
          <p className="status-text">No records.</p>
        ) : (
          <div className="crud-table-wrap" style={{ maxHeight: "28rem", overflow: "auto" }}>
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>User</th>
                  <th>Persona</th>
                  <th>Tool</th>
                  <th>Op</th>
                  <th>ms</th>
                  <th>OK</th>
                  <th>Src</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent.map((row, i) => (
                  <tr key={`${row.ts}-${row.userId}-${row.toolName}-${i}`}>
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.82rem" }}>{row.ts}</td>
                    <td>
                      <code className="status-text">{row.userId.slice(0, 10)}…</code>
                    </td>
                    <td>{row.personaName ?? "—"}</td>
                    <td>
                      <code>{row.toolName}</code>
                    </td>
                    <td>{row.operation ?? "—"}</td>
                    <td>{row.durationMs}</td>
                    <td>{row.ok ? "✓" : "✗"}</td>
                    <td>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
