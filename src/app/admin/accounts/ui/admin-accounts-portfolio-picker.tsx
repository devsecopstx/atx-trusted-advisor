"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { RISK_LEVEL_OPTIONS } from "@/modules/core-admin/portfolio-preference-labels";

type PortfolioRow = {
  _id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  riskProfile?: "conservative" | "balanced" | "growth" | null;
  outlook?: string | null;
  accountCount: number;
  totalCashBalance: number;
  userDisplayName: string;
  userEmail: string | null;
  updatedAt: string;
};

function riskProfileLabel(value: PortfolioRow["riskProfile"] | undefined): string {
  const v = value ?? null;
  if (!v) {
    return "—";
  }
  return RISK_LEVEL_OPTIONS.find((o) => o.riskProfile === v)?.label ?? v;
}

function truncateOutlook(text: string | null, maxChars: number): { short: string; full: string | null } {
  const full = (text ?? "").trim();
  if (!full) {
    return { short: "—", full: null };
  }
  if (full.length <= maxChars) {
    return { short: full, full: null };
  }
  return { short: `${full.slice(0, maxChars - 1)}…`, full: full };
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export function AdminAccountsPortfolioPicker() {
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [status, setStatus] = useState("Loading…");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading portfolios…");
    try {
      const payload = await parseJson<{ data: PortfolioRow[] }>(
        await fetch("/api/admin/portfolios", { cache: "no-store" })
      );
      setRows(payload.data);
      setStatus(`Loaded ${payload.data.length} portfolio(s) — pick one to manage accounts.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="panel stack-gap">
      <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <Link className="cta cta-secondary" href="/admin">
          ← Admin hub
        </Link>
        <Link className="cta cta-secondary" href="/admin/portfolios">
          Portfolios
        </Link>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h2 className="hero-title" style={{ fontSize: "1.25rem" }}>
          Choose a portfolio
        </h2>
        <p className="status-text" style={{ marginBottom: "1rem" }}>
          Choose a portfolio, then edit accounts (create, update, delete). Use <strong>Save changes</strong> on the
          account screen to persist all edits, or save a single row with the row action. Broker holdings CSV import is on
          the <Link href="/admin/broker-import">Broker import</Link> hub (or use the button on a portfolio&apos;s accounts
          page).
        </p>

        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Portfolio</th>
                <th>Owner</th>
                <th>Default</th>
                <th>Risk</th>
                <th>Outlook</th>
                <th>Accounts</th>
                <th>Total cash</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const outlook = truncateOutlook(row.outlook ?? null, 64);
                return (
                  <tr key={row._id}>
                    <td className="font-semibold">{row.name}</td>
                    <td style={{ maxWidth: 220 }}>
                      <div className="text-sm">{row.userDisplayName}</div>
                      {row.userEmail ? (
                        <div className="status-text break-all" style={{ fontSize: "0.75rem" }}>
                          {row.userEmail}
                        </div>
                      ) : null}
                      <div className="font-mono opacity-70 break-all" style={{ fontSize: "0.65rem" }} title={row.userId}>
                        {row.userId}
                      </div>
                    </td>
                    <td>{row.isDefault ? "Yes" : "—"}</td>
                    <td className="text-sm whitespace-nowrap">{riskProfileLabel(row.riskProfile ?? null)}</td>
                    <td
                      className="text-xs max-w-[14rem]"
                      style={{ verticalAlign: "top" }}
                      title={outlook.full ?? (outlook.short !== "—" ? outlook.short : undefined)}
                    >
                      {outlook.short}
                    </td>
                    <td>{row.accountCount}</td>
                    <td>{money.format(row.totalCashBalance)}</td>
                    <td className="text-xs whitespace-nowrap">{new Date(row.updatedAt).toLocaleString()}</td>
                    <td>
                      <Link className="cta cta-primary" href={`/admin/portfolios/${encodeURIComponent(row._id)}/accounts`}>
                        Manage accounts
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && !loading ? (
          <p className="status-text" style={{ marginTop: "0.75rem" }}>
            No portfolios yet — create one under <Link href="/admin/portfolios">Portfolios</Link>.
          </p>
        ) : null}
      </article>
    </section>
  );
}
