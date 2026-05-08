import {
    getAdminXchatModelCostSummary,
    getAdminXchatToolUsageSummary,
    getAdminXchatVendorSpendByTenantPersona,
    getAdminXchatVendorSpendDaily
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
  const vendorDaily = await getAdminXchatVendorSpendDaily({ sinceIso: summary.sinceIso });
  const vendorByTenantPersona = await getAdminXchatVendorSpendByTenantPersona({
    sinceIso: summary.sinceIso
  });

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h2>xChat usage & spend</h2>
        <p className="status-text">
          Fire-and-forget tool rows from <code>/api/xchat/ask</code> → MongoDB <code>xchat_tool_usage</code>. Model /
          token rows come from <code>xchat_logs</code> (same window). Vendor{" "}
          <strong>
            <code>cost_in_usd_ticks</code>
          </strong>{" "}
          appears when xAI returns it on Responses <code>usage</code> (stored as <code>xaiUsage.costUsdTicks</code>).
          Last {summary.windowDays} days since {summary.sinceIso}.
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
        <h3>Vendor-reported spend (usd ticks)</h3>
        <p className="status-text">
          Raw sums from <code>xchat_logs.xaiUsage.costUsdTicks</code>. Interpretation matches xAI billing console (see
          vendor docs for tick → USD mapping). Rows without vendor ticks are excluded — enable history persistence and a
          recent xAI API that returns <code>cost_in_usd_ticks</code>.
        </p>
        {vendorDaily.length === 0 ? (
          <p className="status-text">No vendor tick rows in this window.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Day (UTC)</th>
                  <th>Turns</th>
                  <th>Σ ticks</th>
                </tr>
              </thead>
              <tbody>
                {vendorDaily.map((row) => (
                  <tr key={row.dayUtc}>
                    <td>{row.dayUtc}</td>
                    <td>{row.turns}</td>
                    <td>{row.vendorUsdTicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Vendor ticks by tenant + persona</h3>
        {vendorByTenantPersona.length === 0 ? (
          <p className="status-text">No vendor tick rows in this window.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Persona</th>
                  <th>Turns</th>
                  <th>Σ ticks</th>
                </tr>
              </thead>
              <tbody>
                {vendorByTenantPersona.map((row) => (
                  <tr
                    key={`${row.tenantIdHex}:${row.personaIdHex ?? "none"}:${row.personaName ?? ""}`}
                  >
                    <td>
                      <code>{row.tenantIdHex}</code>
                    </td>
                    <td>
                      {row.personaName ?? "—"}{" "}
                      {row.personaIdHex ? (
                        <code className="status-text">({row.personaIdHex.slice(0, 10)}…)</code>
                      ) : null}
                    </td>
                    <td>{row.turns}</td>
                    <td>{row.vendorUsdTicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="status-text" style={{ marginTop: "0.75rem" }}>
          Tenant breach alerts: create an{" "}
          <strong>
            <code>xchat_spend_alert</code>
          </strong>{" "}
          scheduled task (tenant-scoped) and set{" "}
          <code>core_tenants.tenantPreferences.xchat_daily_spend_alert_usd_ticks</code>.
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
