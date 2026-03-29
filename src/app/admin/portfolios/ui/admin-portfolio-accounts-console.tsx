"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { parseAccountOutlook, type AccountOutlook } from "@/modules/core-admin/types";

import {
    accountOutlookValues,
    DESK_OUTLOOK_LABELS,
    DESK_RISK_PROFILE_OPTIONS,
    type DeskRiskProfileOption
} from "./desk-risk-outlook-options";
import { PortfolioManageNav } from "./portfolio-manage-nav";

const ACCOUNT_TYPES = ["merrill", "fidelity", "etrade", "ibkr"] as const;

const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  merrill: "Merrill",
  fidelity: "Fidelity",
  etrade: "E*TRADE",
  ibkr: "Interactive Brokers (IBKR)"
};

type AccountRow = {
  _id: string;
  name: string;
  type: string;
  extAccountId: string;
  cashBalance: number;
  isDefault: boolean;
  riskProfile: DeskRiskProfileOption | null;
  outlook: AccountOutlook | null;
  createdAt: string;
  updatedAt: string;
};

type PortfolioMeta = {
  _id: string;
  name: string;
  userId: string;
  /** Present when `GET …/accounts` is served by Next; BFF may omit until Kotlin adds parity. */
  userDisplayName?: string;
  userEmail?: string | null;
  tenantPortfolioOrgKey?: string;
  riskProfile: DeskRiskProfileOption | null;
  /** Book-level free text (distinct from account outlook slugs). */
  outlook: string | null;
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

function normalizeRiskValue(
  v: AccountRow["riskProfile"] | undefined | ""
): DeskRiskProfileOption | null {
  if (v === undefined || v === null || v === "") {
    return null;
  }
  return (DESK_RISK_PROFILE_OPTIONS as readonly string[]).includes(v)
    ? (v as DeskRiskProfileOption)
    : null;
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

  const riskNext = normalizeRiskValue(m.riskProfile);
  const riskPrev = normalizeRiskValue(row.riskProfile);
  if (riskNext !== riskPrev) {
    body.riskProfile = riskNext;
  }
  const outNext = parseAccountOutlook(m.outlook);
  const outPrev = parseAccountOutlook(row.outlook);
  if (outNext !== outPrev) {
    body.outlook = outNext;
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
  /** Book-level fields (PATCH portfolio); kept in sync on refresh. */
  const [portfolioRiskDraft, setPortfolioRiskDraft] = useState<DeskRiskProfileOption | "">("");
  const [portfolioOutlookDraft, setPortfolioOutlookDraft] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading accounts…");
    try {
      const payload = await parseJson<{
        data: {
          portfolio: Omit<PortfolioMeta, "riskProfile" | "outlook" | "userDisplayName" | "userEmail"> & {
            riskProfile?: string | null;
            outlook?: string | null;
            userDisplayName?: string;
            userEmail?: string | null;
          };
          accountCount: number;
          totalCashBalance: number;
          accounts: AccountRow[];
        };
      }>(await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`, { cache: "no-store" }));
      const raw = payload.data.portfolio;
      const riskNorm =
        raw.riskProfile && (DESK_RISK_PROFILE_OPTIONS as readonly string[]).includes(raw.riskProfile)
          ? (raw.riskProfile as DeskRiskProfileOption)
          : null;
      const po: PortfolioMeta = {
        ...raw,
        riskProfile: riskNorm,
        outlook: raw.outlook ?? null,
        userDisplayName: typeof raw.userDisplayName === "string" ? raw.userDisplayName : undefined,
        userEmail: "userEmail" in raw ? (raw.userEmail ?? null) : undefined
      };
      setPortfolio(po);
      setPortfolioRiskDraft(riskNorm ?? "");
      setPortfolioOutlookDraft(po.outlook ?? "");
      setAccountCount(payload.data.accountCount);
      setTotalCashBalance(payload.data.totalCashBalance);
      setAccounts(
        payload.data.accounts.map((a) => ({
          ...a,
          riskProfile:
            a.riskProfile &&
            (DESK_RISK_PROFILE_OPTIONS as readonly string[]).includes(a.riskProfile as string)
              ? (a.riskProfile as DeskRiskProfileOption)
              : null,
          outlook: parseAccountOutlook(a.outlook)
        }))
      );
      setEdits({});
      setStatus(`Loaded ${payload.data.accounts.length} account(s)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setPortfolio(null);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!portfolio?.userId || portfolio.userDisplayName !== undefined) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(portfolio.userId)}`, {
          cache: "no-store"
        });
        if (!res.ok || cancelled) {
          return;
        }
        const payload = await parseJson<{
          data: {
            email?: string;
            xAccount?: { username?: string; displayName?: string };
          };
        }>(res);
        const d = payload.data;
        const display =
          d.xAccount?.displayName?.trim() ||
          d.xAccount?.username?.trim() ||
          d.email?.trim() ||
          "User";
        if (!cancelled) {
          setPortfolio((p) =>
            p ? { ...p, userDisplayName: display, userEmail: d.email ?? null } : p
          );
        }
      } catch {
        /* BFF or transient failure — owner id still visible */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolio?.userId, portfolio?.userDisplayName]);

  const draft = (id: string): Partial<AccountRow> => edits[id] ?? {};

  const mergeRow = (row: AccountRow): AccountRow => ({ ...row, ...draft(row._id) });

  const hasDirty = useMemo(() => {
    const d = (id: string) => edits[id] ?? {};
    return accounts.some(
      (row) => computeAccountPatchBody(row, d(row._id), cashFocusId === row._id, cashEditText[row._id]) !== null
    );
  }, [accounts, edits, cashFocusId, cashEditText]);

  const bookRiskOutlookDirty = useMemo(() => {
    if (!portfolio) {
      return false;
    }
    const riskPrev = portfolio.riskProfile ?? null;
    const riskDraft = portfolioRiskDraft === "" ? null : portfolioRiskDraft;
    if (riskDraft !== riskPrev) {
      return true;
    }
    const outPrev = (portfolio.outlook ?? "").trim();
    const outDraft = portfolioOutlookDraft.trim();
    return outDraft !== outPrev;
  }, [portfolio, portfolioRiskDraft, portfolioOutlookDraft]);

  const hasAnythingDirty = hasDirty || bookRiskOutlookDirty;

  const buildPortfolioBookPatchBody = (): Record<string, unknown> | null => {
    if (!portfolio) {
      return null;
    }
    const body: Record<string, unknown> = {};
    const riskPrev = portfolio.riskProfile ?? null;
    const riskNext = portfolioRiskDraft === "" ? null : portfolioRiskDraft;
    if (riskNext !== riskPrev) {
      body.riskProfile = riskNext;
    }
    const outPrev = (portfolio.outlook ?? "").trim();
    const outDraft = portfolioOutlookDraft.trim();
    if (outDraft !== outPrev) {
      body.outlook = outDraft.length > 0 ? outDraft : null;
    }
    return Object.keys(body).length > 0 ? body : null;
  };

  const persistPortfolioBookIfDirty = async (): Promise<boolean> => {
    const body = buildPortfolioBookPatchBody();
    if (!body) {
      return false;
    }
    await parseJson(
      await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
    );
    return true;
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
    if (targets.length === 0 && !bookRiskOutlookDirty) {
      setStatus("No changes");
      return;
    }

    setCashFocusId(null);
    setCashEditText(mergedCashText);
    setEdits(mergedEdits);
    setLoading(true);
    setStatus("Saving…");
    try {
      let savedBook = false;
      if (bookRiskOutlookDirty) {
        savedBook = await persistPortfolioBookIfDirty();
      }
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
      const parts: string[] = [];
      if (savedBook) {
        parts.push("book risk & outlook");
      }
      if (saved > 0) {
        parts.push(`${saved} account(s)`);
      }
      setStatus(parts.length > 0 ? `Saved ${parts.join(" · ")}` : "Saved");
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
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <button
          className="cta cta-primary"
          disabled={loading || !hasAnythingDirty}
          onClick={() => void saveAllChanges()}
          type="button"
        >
          <SaveIcon className="crud-icon" /> Save changes
        </button>
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
        <p className="status-text">{status}</p>
      </PortfolioManageNav>

      {portfolio ? (
        <article className="surface-card xf-widget section-card">
          <h2 className="hero-title" style={{ fontSize: "1.25rem" }}>
            {portfolio.name}
          </h2>
          <p className="status-text font-mono text-xs">Portfolio ID: {portfolio._id}</p>
          <div style={{ marginTop: "0.5rem", maxWidth: 280 }}>
            <p className="status-text text-xs font-semibold uppercase tracking-wide" style={{ marginBottom: "0.25rem" }}>
              User
            </p>
            {portfolio.userId ? (
              <>
                <Link
                  className="login-xoptions-link font-semibold text-sm"
                  href={`/admin/manage_account?userId=${encodeURIComponent(portfolio.userId)}&portfolioId=${encodeURIComponent(portfolioId)}`}
                  title="Open user settings"
                >
                  {portfolio.userDisplayName?.trim() || "User"}
                </Link>
                <Link
                  className="font-mono break-all opacity-75 hover:opacity-100 underline-offset-2 hover:underline"
                  href={`/admin/manage_account?userId=${encodeURIComponent(portfolio.userId)}&portfolioId=${encodeURIComponent(portfolioId)}`}
                  style={{ fontSize: "0.65rem", display: "block", marginTop: "0.12rem" }}
                  title="User id — same link as display name"
                >
                  {portfolio.userId}
                </Link>
                {portfolio.userEmail ? (
                  <div className="status-text break-all" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
                    {portfolio.userEmail}
                  </div>
                ) : null}
              </>
            ) : (
              <span className="status-text">—</span>
            )}
          </div>
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

      <article className="surface-card xf-widget section-card">
        <h3>Accounts</h3>
        <p className="status-text" style={{ marginBottom: "0.75rem" }}>
          Edit inline like the main <strong>Portfolios</strong> table: change fields, then press <strong>Save changes</strong>{" "}
          (book risk &amp; outlook + all dirty account rows in one batch). <strong>Book risk &amp; outlook</strong> apply to
          the whole portfolio (controls on the first row). <strong>Acct risk / Acct outlook</strong> are per custodian
          account. Watchlist desk fields live under <strong>Manage watchlist</strong>.
        </p>
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>External ID</th>
                <th>Cash balance</th>
                <th title="Portfolio-wide desk risk (PATCH book)">Book risk</th>
                <th title="Portfolio-wide desk outlook note (PATCH book)">Book outlook</th>
                <th title="Per-account risk profile">Acct risk</th>
                <th title="Per-account outlook slug">Acct outlook</th>
                <th>Default</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="status-text text-sm">
                    No accounts yet — add one below. You can still set book desk fields for this portfolio.
                  </td>
                  <td style={{ minWidth: "8.5rem", verticalAlign: "top" }}>
                    {portfolio ? (
                      <select
                        className="crud-input text-xs"
                        value={portfolioRiskDraft}
                        onChange={(e) =>
                          setPortfolioRiskDraft(
                            e.target.value === "" ? "" : (e.target.value as DeskRiskProfileOption)
                          )
                        }
                        aria-label="Book risk profile"
                      >
                        <option value="">—</option>
                        {DESK_RISK_PROFILE_OPTIONS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="status-text">—</span>
                    )}
                  </td>
                  <td style={{ minWidth: "10rem", verticalAlign: "top" }}>
                    {portfolio ? (
                      <input
                        className="crud-input text-xs"
                        value={portfolioOutlookDraft}
                        onChange={(e) => setPortfolioOutlookDraft(e.target.value)}
                        placeholder="Short desk note"
                        aria-label="Book outlook"
                      />
                    ) : (
                      <span className="status-text">—</span>
                    )}
                  </td>
                  <td colSpan={5} className="status-text text-xs">
                    —
                  </td>
                </tr>
              ) : (
                accounts.map((row, idx) => {
                  const m = mergeRow(row);
                  const rs = accounts.length;
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
                              {ACCOUNT_TYPE_LABELS[t]}
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
                      {!portfolio ? (
                        <>
                          <td className="status-text text-xs">—</td>
                          <td className="status-text text-xs">—</td>
                        </>
                      ) : idx === 0 ? (
                        <>
                          <td rowSpan={rs} style={{ minWidth: "8.5rem", verticalAlign: "top" }}>
                            <select
                              className="crud-input text-xs"
                              value={portfolioRiskDraft}
                              onChange={(e) =>
                                setPortfolioRiskDraft(
                                  e.target.value === "" ? "" : (e.target.value as DeskRiskProfileOption)
                                )
                              }
                              aria-label="Book risk profile"
                            >
                              <option value="">—</option>
                              {DESK_RISK_PROFILE_OPTIONS.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <p className="status-text text-xs" style={{ marginTop: "0.35rem", maxWidth: "11rem" }}>
                              Same value for every account row (portfolio scope).
                            </p>
                          </td>
                          <td rowSpan={rs} style={{ minWidth: "10rem", verticalAlign: "top" }}>
                            <input
                              className="crud-input text-xs"
                              value={portfolioOutlookDraft}
                              onChange={(e) => setPortfolioOutlookDraft(e.target.value)}
                              placeholder="Short desk note"
                              aria-label="Book outlook"
                            />
                          </td>
                        </>
                      ) : null}
                      <td style={{ minWidth: "8.5rem" }}>
                        <select
                          className="crud-input text-xs"
                          value={normalizeRiskValue(m.riskProfile) ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEdits((prev) => ({
                              ...prev,
                              [row._id]: {
                                ...prev[row._id],
                                riskProfile: v === "" ? null : (v as DeskRiskProfileOption)
                              }
                            }));
                          }}
                        >
                          <option value="">—</option>
                          {DESK_RISK_PROFILE_OPTIONS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ minWidth: "9rem" }}>
                        <select
                          className="crud-input text-xs"
                          value={parseAccountOutlook(m.outlook) ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEdits((prev) => ({
                              ...prev,
                              [row._id]: {
                                ...prev[row._id],
                                outlook: v === "" ? null : (v as AccountOutlook)
                              }
                            }));
                          }}
                        >
                          <option value="">—</option>
                          {accountOutlookValues.map((v) => (
                            <option key={v} value={v}>
                              {DESK_OUTLOOK_LABELS[v]}
                            </option>
                          ))}
                        </select>
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
                        <div className="tool-row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                          <Link
                            className="cta cta-secondary"
                            href={`/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(row._id)}/holdings`}
                            title="Holdings (positions)"
                          >
                            Holdings
                          </Link>
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
                })
              )}
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
                  {ACCOUNT_TYPE_LABELS[t]}
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
