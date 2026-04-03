import {
    getAdminXchatModelCostSummary,
    getAdminXchatToolUsageSummary
} from "@/modules/xchat/tool-usage-repository";
import { estimateHostedToolUsd } from "@/modules/xchat/xai-model-pricing";

const XAI_MODELS_DOC = "https://docs.x.ai/docs/models";

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) {
    return "—";
  }
  const abs = Math.abs(n);
  const digits = abs > 0 && abs < 0.01 ? 4 : 2;
  return `$${n.toFixed(digits)}`;
}

export default async function AdminXchatToolUsagePage() {
  const windowDays = 7;
  const recentLimit = 60;
  const summary = await getAdminXchatToolUsageSummary({ windowDays, recentLimit });
  const modelCost = await getAdminXchatModelCostSummary({
    windowDays: summary.windowDays,
    sinceIso: summary.sinceIso,
    byTool: summary.byTool
  });

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h2>xChat tool usage</h2>
        <p className="status-text">
          Fire-and-forget tool rows from <code>/api/xchat/ask</code> → MongoDB <code>xchat_tool_usage</code>. Model /
          token rows come from <code>xchat_logs</code> (same window). Last {summary.windowDays} days since{" "}
          {summary.sinceIso}.
        </p>
        <p className="status-text">
          <strong>Hosted tool calls:</strong> {summary.totalCalls}
        </p>
        <p className="status-text">
          <strong>xChat turns (logs):</strong> {modelCost.totalChatTurns}
          {modelCost.turnsWithUsage > 0 ? (
            <>
              {" "}
              · <strong>turns with token usage captured:</strong> {modelCost.turnsWithUsage}
            </>
          ) : null}
        </p>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Estimated cost (USD)</h3>
        <p className="status-text">
          Rough estimate from public{" "}
          <a href={XAI_MODELS_DOC} rel="noopener noreferrer" target="_blank">
            xAI model + tool pricing
          </a>
          . Token costs use <code>xchat_logs.xaiUsage</code> when the Responses API returns a <code>usage</code> object;
          older rows may lack usage (deploy after this change). Hosted-tool surcharges use{" "}
          <code>xchat_tool_usage</code> call counts. Verify against xAI Console billing — aliases and promos may differ.
        </p>
        <ul className="status-text" style={{ listStyle: "disc", paddingLeft: "1.25rem" }}>
          <li>
            <strong>LLM tokens (estimated):</strong> {formatUsd(modelCost.estimatedTokenUsdTotal)}
          </li>
          <li>
            <strong>xAI hosted tools (estimated):</strong> {formatUsd(modelCost.estimatedHostedToolUsdTotal)}
          </li>
          <li>
            <strong>Combined (estimated):</strong> {formatUsd(modelCost.estimatedGrandTotalUsd)}
          </li>
        </ul>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>By model — xChat turns ({summary.windowDays}d)</h3>
        {modelCost.byModel.length === 0 ? (
          <p className="status-text">No xchat_logs in this window.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Turns</th>
                  <th>w/ usage</th>
                  <th>In tok</th>
                  <th>Out tok</th>
                  <th>Reason</th>
                  <th>Cache in</th>
                  <th>Tier</th>
                  <th>Est. $</th>
                </tr>
              </thead>
              <tbody>
                {modelCost.byModel.map((row) => (
                  <tr key={row.model}>
                    <td>
                      <code>{row.model}</code>
                    </td>
                    <td>{row.turns}</td>
                    <td>{row.turnsWithUsage}</td>
                    <td>{row.inputTokens.toLocaleString()}</td>
                    <td>{row.outputTokens.toLocaleString()}</td>
                    <td>{row.reasoningTokens.toLocaleString()}</td>
                    <td>{row.cachedPromptTokens.toLocaleString()}</td>
                    <td>{row.pricingTierLabel ?? "—"}</td>
                    <td>{row.estimatedTokenUsd != null ? formatUsd(row.estimatedTokenUsd) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <th>Est. hosted $</th>
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
                    <td>{formatUsd(estimateHostedToolUsd(row.toolName, row.count))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Recent tool calls</h3>
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
