"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AddIcon, DeleteIcon, EditIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

import { PortfolioManageNav } from "./portfolio-manage-nav";

const ACCOUNT_TYPES = ["merrill", "fidelity", "etrade"] as const;

const RISK_PROFILE_OPTIONS = ["conservative", "balanced", "growth"] as const;
type RiskProfileOption = (typeof RISK_PROFILE_OPTIONS)[number];

type AccountRow = {
  _id: string;
  name: string;
  type: string;
  extAccountId: string;
  cashBalance: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type PortfolioMeta = {
  _id: string;
  name: string;
  userId: string;
  tenantPortfolioOrgKey?: string;
  riskProfile?: RiskProfileOption | null;
  outlook?: string | null;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function parseUsdCashInput(raw: string): number | undefined {
  const n = Number.parseFloat(raw.replaceAll(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    return undefined;
  }
  return n;
}

function cashCellNumber(row: AccountRow, draftCash: number | undefined): number {
  if (typeof draftCash === "number" && Number.isFinite(draftCash)) {
    return draftCash;
  }
  const b = row.cashBalance;
  return typeof b === "number" && Number.isFinite(b) ? b : 0;
}

function computeAccountPatchBody(
  row: AccountRow,
  rowDraft: Partial<AccountRow>,
  cashRowActive: boolean,
  cashInputText: string | undefined
): Record<string, unknown> | null {
  let cashOverride: number | undefined;
  if (cashRowActive) {
    const parsed = parseUsdCashInput(cashInputText ?? "");
    if (parsed !== undefined) {
      cashOverride = parsed;
    }
  }
  const m: AccountRow = {
    ...row,
    ...rowDraft,
    ...(cashOverride !== undefined ? { cashBalance: cashOverride } : {})
  };
  const body: Record<string, unknown> = {};
  const nameNext = (m.name ?? "").trim();
  const namePrev = (row.name ?? "").trim();
  if (nameNext !== namePrev) {
    if (!nameNext) {
      return null;
    }
    body.name = nameNext;
  }
  if (m.type !== row.type && ACCOUNT_TYPES.includes(m.type as (typeof ACCOUNT_TYPES)[number])) {
    body.type = m.type;
  }
  const extNext = (m.extAccountId ?? "").trim();
  const extPrev = (row.extAccountId ?? "").trim();
  if (extNext !== extPrev && extNext.length > 0) {
    body.extAccountId = extNext;
  }
  const cashRow = typeof row.cashBalance === "number" && Number.isFinite(row.cashBalance) ? row.cashBalance : 0;
  const cashMerged =
    typeof m.cashBalance === "number" && Number.isFinite(m.cashBalance) ? m.cashBalance : cashRow;
  if (cashMerged !== cashRow && cashMerged >= 0 && Number.isFinite(cashMerged)) {
    body.cashBalance = cashMerged;
  }
  if (m.isDefault === true && row.isDefault !== true) {
    body.isDefault = true;
  }
  return Object.keys(body).length > 0 ? body : null;
}

type AdminPortfolioAccountsConsoleProps = {
  portfolioId: string;
};

export function AdminPortfolioAccountsConsole({ portfolioId }: AdminPortfolioAccountsConsoleProps) {
  const [portfolio, setPortfolio] = useState<PortfolioMeta | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountCount, setAccountCount] = useState(0);
  const [totalCashBalance, setTotalCashBalance] = useState(0);
  const [status, setStatus] = useState("Loading…");
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<AccountRow>>>({});

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<(typeof ACCOUNT_TYPES)[number]>("fidelity");
  const [newExt, setNewExt] = useState("");
  const [newCash, setNewCash] = useState("");
  /** Row id actively editing cash — value in `cashEditText` until blur. */
  const [cashFocusId, setCashFocusId] = useState<string | null>(null);
  const [cashEditText, setCashEditText] = useState<Record<string, string>>({});
  const [riskProfileDraft, setRiskProfileDraft] = useState<"" | RiskProfileOption>("");
  const [outlookDraft, setOutlookDraft] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading accounts…");
    try {
      const payload = await parseJson<{
        data: {
          portfolio: PortfolioMeta;
          accountCount: number;
          totalCashBalance: number;
          accounts: AccountRow[];
        };
      }>(await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`, { cache: "no-store" }));
      const po = payload.data.portfolio;
      setPortfolio(po);
      setAccountCount(payload.data.accountCount);
      setTotalCashBalance(payload.data.totalCashBalance);
      setAccounts(payload.data.accounts);
      setEdits({});
      const rp = po.riskProfile;
      setRiskProfileDraft(
        rp && (RISK_PROFILE_OPTIONS as readonly string[]).includes(rp) ? (rp as RiskProfileOption) : ""
      );
      setOutlookDraft(typeof po.outlook === "string" ? po.outlook : "");
      setStatus(`Loaded ${payload.data.accounts.length} account(s)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setPortfolio(null);
      setAccounts([]);
      setRiskProfileDraft("");
      setOutlookDraft("");
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const draft = (id: string): Partial<AccountRow> => edits[id] ?? {};

  const mergeRow = (row: AccountRow): AccountRow => ({ ...row, ...draft(row._id) });

  const hasDirty = useMemo(() => {
    const d = (id: string) => edits[id] ?? {};
    return accounts.some(
      (row) => computeAccountPatchBody(row, d(row._id), cashFocusId === row._id, cashEditText[row._id]) !== null
    );
  }, [accounts, edits, cashFocusId, cashEditText]);

  const hasPortfolioRiskOutlookDirty = useMemo(() => {
    if (!portfolio) {
      return false;
    }
    const savedRisk = portfolio.riskProfile ?? "";
    const savedOut = (portfolio.outlook ?? "").trim();
    return (riskProfileDraft || "") !== savedRisk || outlookDraft.trim() !== savedOut;
  }, [portfolio, riskProfileDraft, outlookDraft]);

  const savePortfolioRiskOutlook = async () => {
    if (!portfolio) {
      return;
    }
    setLoading(true);
    setStatus("Saving risk & outlook…");
    try {
      await parseJson(
        await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            riskProfile: riskProfileDraft === "" ? null : riskProfileDraft,
            outlook: outlookDraft.trim() === "" ? null : outlookDraft.trim()
          })
        })
      );
      setStatus("Saved risk & outlook");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const saveAccount = async (row: AccountRow) => {
    const body = computeAccountPatchBody(row, draft(row._id), cashFocusId === row._id, cashEditText[row._id]);
    if (cashFocusId === row._id) {
      setCashFocusId(null);
      setCashEditText((prev) => {
        const next = { ...prev };
        delete next[row._id];
        return next;
      });
    }

    setStatus("Saving…");
    try {
      if (!body) {
        const m = mergeRow(row);
        const nameNext = (m.name ?? "").trim();
        const namePrev = (row.name ?? "").trim();
        if (nameNext !== namePrev && !nameNext) {
          setStatus("Name cannot be empty");
          return;
        }
        setStatus("No changes");
        return;
      }

      await parseJson(
        await fetch(
          `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(row._id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          }
        )
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row._id];
        return next;
      });
      setStatus("Saved");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    }
  };

  const saveAllChanges = async () => {
    let mergedEdits = { ...edits };
    const mergedCashText = { ...cashEditText };
    const fid = cashFocusId;
    if (fid) {
      const parsed = parseUsdCashInput(mergedCashText[fid] ?? "");
      delete mergedCashText[fid];
      if (parsed !== undefined) {
        mergedEdits = { ...mergedEdits, [fid]: { ...mergedEdits[fid], cashBalance: parsed } };
      }
    }

    const draftMerged = (id: string) => mergedEdits[id] ?? {};
    const targets = accounts.filter(
      (row) => computeAccountPatchBody(row, draftMerged(row._id), false, undefined) !== null
    );
    if (targets.length === 0) {
      setStatus("No changes");
      return;
    }

    setCashFocusId(null);
    setCashEditText(mergedCashText);
    setEdits(mergedEdits);
    setLoading(true);
    setStatus("Saving…");
    try {
      let saved = 0;
      for (const row of targets) {
        const body = computeAccountPatchBody(row, draftMerged(row._id), false, undefined);
        if (!body) {
          setStatus("Name cannot be empty");
          return;
        }
        await parseJson(
          await fetch(
            `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(row._id)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            }
          )
        );
        saved += 1;
        delete mergedEdits[row._id];
      }
      setEdits({ ...mergedEdits });
      setStatus(`Saved ${saved} account(s)`);
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (row: AccountRow) => {
    if (!window.confirm(`Delete account "${row.name}" and its position lots?`)) {
      return;
    }
    setStatus("Deleting…");
    try {
      await parseJson(
        await fetch(
          `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(row._id)}`,
          { method: "DELETE" }
        )
      );
      setStatus("Deleted");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const addAccount = async () => {
    const name = newName.trim();
    if (!name) {
      setStatus("Enter account name");
      return;
    }
    setStatus("Creating…");
    try {
      const body: Record<string, unknown> = { name, type: newType };
      const ext = newExt.trim();
      if (ext) body.extAccountId = ext;
      const cash = Number.parseFloat(newCash.replaceAll(/[$,\s]/g, ""));
      if (Number.isFinite(cash) && cash >= 0) body.cashBalance = cash;

      await parseJson(
        await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      );
      setNewName("");
      setNewExt("");
      setNewCash("");
      setNewType("fidelity");
      setStatus("Created");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Create failed");
    }
  };

  return (
    <section className="panel stack-gap">
      <PortfolioManageNav portfolioId={portfolioId} active="accounts">
        <Link
          className="cta cta-secondary"
          href={`/admin/portfolios/${encodeURIComponent(portfolioId)}/broker-import`}
        >
          Broker import
        </Link>
        {portfolio?.userId ? (
          <Link
            className="cta cta-secondary"
            href={`/admin/manage_account?userId=${encodeURIComponent(portfolio.userId)}&portfolioId=${encodeURIComponent(portfolioId)}`}
          >
            User settings
          </Link>
        ) : null}
        <button
          className="cta cta-primary"
          disabled={loading || !hasDirty}
          onClick={() => void saveAllChanges()}
          type="button"
        >
          Save changes
        </button>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </PortfolioManageNav>

      {portfolio ? (
        <article className="surface-card xf-widget section-card">
          <h2 className="hero-title" style={{ fontSize: "1.25rem" }}>
            {portfolio.name}
          </h2>
          <p className="status-text font-mono text-xs">Portfolio ID: {portfolio._id}</p>
          <p className="status-text font-mono text-xs">User: {portfolio.userId}</p>
          <div className="tool-row" style={{ marginTop: "0.75rem", gap: "1.5rem" }}>
            <p className="status-text">
              <strong>{accountCount}</strong> account(s)
            </p>
            <p className="status-text">
              Total cash (sum): <strong>{money.format(totalCashBalance)}</strong>
            </p>
          </div>
        </article>
      ) : null}

      {portfolio ? (
        <article className="surface-card xf-widget section-card">
          <h3 className="text-sm font-semibold" style={{ marginBottom: "0.35rem" }}>
            Risk &amp; outlook
          </h3>
          <p className="status-text" style={{ marginBottom: "0.75rem" }}>
            Book-level context on this portfolio (optional). Distinct from per-user settings on{" "}
            <Link
              className="login-xoptions-link"
              href={
                portfolio.userId
                  ? `/admin/manage_account?userId=${encodeURIComponent(portfolio.userId)}&portfolioId=${encodeURIComponent(portfolioId)}`
                  : "/admin/manage_account"
              }
            >
              Manage account
            </Link>
            .
          </p>
          <div
            className="stack-gap"
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "42rem" }}
          >
            <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              Risk profile
              <select
                className="crud-input"
                value={riskProfileDraft}
                onChange={(e) =>
                  setRiskProfileDraft(
                    e.target.value === "" ? "" : (e.target.value as RiskProfileOption)
                  )
                }
              >
                <option value="">— Not set</option>
                {RISK_PROFILE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              Outlook
              <textarea
                className="crud-input"
                rows={5}
                value={outlookDraft}
                onChange={(e) => setOutlookDraft(e.target.value)}
                placeholder="Market view, positioning notes, horizon…"
                style={{ minHeight: "6rem", resize: "vertical" }}
              />
            </label>
            <div>
              <button
                type="button"
                className="cta cta-primary"
                disabled={loading || !hasPortfolioRiskOutlookDirty}
                onClick={() => void savePortfolioRiskOutlook()}
              >
                Save risk &amp; outlook
              </button>
            </div>
          </div>
        </article>
      ) : null}

      <article className="surface-card xf-widget section-card">
        <h3>Accounts</h3>
        <p className="status-text" style={{ marginBottom: "0.75rem" }}>
          Edit rows below, then <strong>Save changes</strong> or save a single row with the pencil control.
        </p>
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>External ID</th>
                <th>Cash balance</th>
                <th>Default</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((row) => {
                const m = mergeRow(row);
                return (
                  <tr key={row._id}>
                    <td>
                      <input
                        className="crud-input"
                        value={m.name ?? ""}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row._id]: { ...prev[row._id], name: e.target.value }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="crud-input"
                        value={m.type ?? row.type}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row._id]: { ...prev[row._id], type: e.target.value }
                          }))
                        }
                      >
                        {ACCOUNT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="crud-input font-mono text-xs"
                        value={m.extAccountId ?? ""}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row._id]: { ...prev[row._id], extAccountId: e.target.value }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="crud-input font-mono text-sm tabular-nums"
                        type="text"
                        inputMode="decimal"
                        aria-label="Cash balance"
                        value={
                          cashFocusId === row._id
                            ? (cashEditText[row._id] ?? "")
                            : money.format(cashCellNumber(row, draft(row._id).cashBalance))
                        }
                        onFocus={() => {
                          const n = cashCellNumber(row, draft(row._id).cashBalance);
                          setCashFocusId(row._id);
                          setCashEditText((prev) => ({
                            ...prev,
                            [row._id]: String(n)
                          }));
                        }}
                        onChange={(e) => {
                          setCashEditText((prev) => ({
                            ...prev,
                            [row._id]: e.target.value
                          }));
                        }}
                        onBlur={() => {
                          const raw = cashEditText[row._id] ?? "";
                          const parsed = parseUsdCashInput(raw);
                          setCashFocusId((id) => (id === row._id ? null : id));
                          setCashEditText((prev) => {
                            const next = { ...prev };
                            delete next[row._id];
                            return next;
                          });
                          if (parsed === undefined) {
                            return;
                          }
                          const current = cashCellNumber(row, draft(row._id).cashBalance);
                          if (parsed === current) {
                            return;
                          }
                          setEdits((prev) => ({
                            ...prev,
                            [row._id]: { ...prev[row._id], cashBalance: parsed }
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <label className="status-text" style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(m.isDefault ?? row.isDefault)}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [row._id]: { ...prev[row._id], isDefault: e.target.checked }
                            }))
                          }
                        />
                        default
                      </label>
                    </td>
                    <td className="text-xs">{new Date(row.updatedAt).toLocaleString()}</td>
                    <td>
                      <div className="tool-row" style={{ gap: "0.35rem" }}>
                        <button
                          type="button"
                          className="cta cta-secondary"
                          title="Save"
                          onClick={() => void saveAccount(row)}
                        >
                          <EditIcon className="crud-icon" />
                        </button>
                        <button
                          type="button"
                          className="cta cta-secondary"
                          title="Delete"
                          onClick={() => void deleteAccount(row)}
                        >
                          <DeleteIcon className="crud-icon" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="surface-card xf-widget section-card">
        <h4 className="text-sm font-semibold">
          <AddIcon className="crud-icon" /> New account
        </h4>
        <div
          className="stack-gap"
          style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end", marginTop: "0.5rem" }}
        >
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Name
            <input className="crud-input" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Type
            <select className="crud-input" value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            External ID (optional)
            <input className="crud-input font-mono text-xs" value={newExt} onChange={(e) => setNewExt(e.target.value)} />
          </label>
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Cash (optional)
            <input
              className="crud-input"
              value={newCash}
              onChange={(e) => setNewCash(e.target.value)}
              placeholder="$25,000"
            />
          </label>
          <button type="button" className="cta cta-primary" onClick={() => void addAccount()}>
            Add account
          </button>
        </div>
      </article>
    </section>
  );
}
