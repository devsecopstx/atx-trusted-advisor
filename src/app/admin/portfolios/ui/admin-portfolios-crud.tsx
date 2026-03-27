"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type BrokerCatalogOption = { type: string; name: string };

type PortfolioRow = {
  _id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  tenantPortfolioOrgKey?: string;
  ext_broker_ref?: string;
  broker_type?: string | null;
  createdAt: string;
  updatedAt: string;
  accountCount: number;
  totalCashBalance: number;
  userDisplayName: string;
  userEmail: string | null;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function userSettingsHref(userId: string): string {
  return `/admin/manage_account?userId=${encodeURIComponent(userId)}`;
}

export function AdminPortfoliosCrud() {
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<
    Record<string, Partial<Pick<PortfolioRow, "name" | "ext_broker_ref" | "broker_type" | "isDefault">>>
  >({});
  const [createUserId, setCreateUserId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDefault, setCreateDefault] = useState(false);
  const [createBrokerType, setCreateBrokerType] = useState("");
  const [brokerCatalog, setBrokerCatalog] = useState<BrokerCatalogOption[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading portfolios…");
    try {
      const [portfolioRes, brokerRes] = await Promise.all([
        fetch("/api/admin/portfolios", { cache: "no-store" }),
        fetch("/api/admin/brokers", { cache: "no-store" })
      ]);
      const payload = await parseJson<{ data: PortfolioRow[] }>(portfolioRes);
      try {
        const brokers = await parseJson<{ data: BrokerCatalogOption[] }>(brokerRes);
        setBrokerCatalog(brokers.data);
      } catch {
        setBrokerCatalog([]);
      }
      setRows(payload.data);
      setEdits({});
      setStatus(`Loaded ${payload.data.length} portfolio(s)`);
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

  const draft = (id: string) => edits[id] ?? {};

  const mergeRow = (row: PortfolioRow): PortfolioRow => {
    const d = draft(row._id);
    return {
      ...row,
      name: d.name !== undefined ? d.name : row.name,
      ext_broker_ref: d.ext_broker_ref !== undefined ? d.ext_broker_ref ?? "" : row.ext_broker_ref ?? "",
      broker_type: d.broker_type !== undefined ? d.broker_type : row.broker_type ?? null,
      isDefault: d.isDefault !== undefined ? Boolean(d.isDefault) : row.isDefault
    };
  };

  const hasDirty = useMemo(() => Object.keys(edits).length > 0, [edits]);

  const catalogByType = useMemo(() => new Map(brokerCatalog.map((b) => [b.type, b])), [brokerCatalog]);

  const rowBrokerSelectOptions = useCallback(
    (currentSlug: string | null | undefined): BrokerCatalogOption[] => {
      const cur = currentSlug ?? "";
      if (cur && !catalogByType.has(cur)) {
        return [{ type: cur, name: `${cur} (not in catalog)` }, ...brokerCatalog];
      }
      return brokerCatalog;
    },
    [brokerCatalog, catalogByType]
  );

  const selectDefaultForUser = (userId: string, portfolioId: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (r.userId !== userId) continue;
        next[r._id] = {
          ...next[r._id],
          isDefault: r._id === portfolioId
        };
      }
      return next;
    });
  };

  const buildPatchBody = (row: PortfolioRow): Record<string, unknown> | null => {
    const d = draft(row._id);
    const m = mergeRow(row);
    const body: Record<string, unknown> = {};
    if (d.name !== undefined) {
      const trimmed = (m.name ?? "").trim();
      if (trimmed.length === 0) {
        return null;
      }
      body.name = trimmed;
    }
    if (d.ext_broker_ref !== undefined) {
      const v = (m.ext_broker_ref ?? "").trim();
      body.ext_broker_ref = v.length > 0 ? v : null;
    }
    if (d.broker_type !== undefined) {
      body.broker_type = m.broker_type;
    }
    if (m.isDefault && (!row.isDefault || d.isDefault === true)) {
      body.isDefault = true;
    }
    if (Object.keys(body).length === 0) {
      return null;
    }
    return body;
  };

  const persistRow = async (row: PortfolioRow) => {
    const body = buildPatchBody(row);
    if (!body) {
      return;
    }
    await parseJson(
      await fetch(`/api/admin/portfolios/${encodeURIComponent(row._id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
    );
  };

  const saveAllChanges = async () => {
    if (!hasDirty) {
      setStatus("No changes to save");
      return;
    }
    const emptyNameRow = rows.find((r) => {
      const d = draft(r._id);
      if (d.name === undefined) {
        return false;
      }
      return mergeRow(r).name.trim().length === 0;
    });
    if (emptyNameRow) {
      setStatus(
        `Portfolio name cannot be empty — restore text in the first column for portfolio _id ${emptyNameRow._id.slice(0, 8)}…`
      );
      return;
    }
    setLoading(true);
    setStatus("Saving…");
    try {
      const ids = Object.keys(edits);
      const defaultLast = [...ids].sort((a, b) => {
        const ra = rows.find((r) => r._id === a);
        const rb = rows.find((r) => r._id === b);
        const ma = ra ? mergeRow(ra).isDefault : false;
        const mb = rb ? mergeRow(rb).isDefault : false;
        if (ma === mb) return 0;
        return ma ? 1 : -1;
      });
      for (const id of defaultLast) {
        const row = rows.find((r) => r._id === id);
        if (!row) continue;
        await persistRow(row);
      }
      setEdits({});
      setStatus("Saved");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (row: PortfolioRow) => {
    if (!window.confirm(`Delete portfolio "${row.name}" and all linked accounts, positions, and watchlists?`)) {
      return;
    }
    setStatus("Deleting…");
    try {
      await parseJson(
        await fetch(`/api/admin/portfolios/${encodeURIComponent(row._id)}`, { method: "DELETE" })
      );
      setStatus("Deleted");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const createPortfolio = async () => {
    const uid = createUserId.trim();
    const name = createName.trim();
    if (!uid || !name) {
      setStatus("Enter userId and portfolio name");
      return;
    }
    setStatus("Creating…");
    try {
      await parseJson(
        await fetch("/api/admin/portfolios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: uid,
            name,
            isDefault: createDefault,
            ...(createBrokerType ? { broker_type: createBrokerType } : {})
          })
        })
      );
      setCreateUserId("");
      setCreateName("");
      setCreateDefault(false);
      setCreateBrokerType("");
      setStatus("Created");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Create failed");
    }
  };

  return (
    <article className="surface-card xf-widget section-card">
      <div className="tool-row" style={{ marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <button
          className="cta cta-primary"
          disabled={loading || !hasDirty}
          onClick={() => void saveAllChanges()}
          type="button"
        >
          Save changes
        </button>
        <p className="status-text">{status}</p>
      </div>

      <h3>All tenant portfolios</h3>
      <div className="status-text" style={{ marginBottom: "0.75rem" }}>
        <strong>Portfolio name</strong> is the first column — type directly in the field, then press{" "}
        <strong>Save changes</strong> (same flow after <code className="font-mono text-xs">seed:admin</code>).{" "}
        <strong>User</strong> shows display name + id: both link to{" "}
        <Link className="underline font-medium" href="/admin/manage_account">
          user settings
        </Link>{" "}
        (not a dropdown — books are listed here; pick the user to open their admin profile). Also edit{" "}
        <strong>tenant org ref</strong> (stored as <code className="font-mono text-xs">ext_broker_ref</code>) and
        broker type (slugs from the{" "}
        <Link className="underline font-medium" href="/admin/brokers">
          broker catalog
        </Link>
        ). Choose one default per user (radio). Tenant org key is read-only.
      </div>

      <div className="crud-table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th title="Editable portfolio / book name">Name</th>
              <th title="Links open User settings for that core user">User</th>
              <th>Tenant org key</th>
              <th title="Cohort / integration grouping; persisted as ext_broker_ref">Tenant org ref</th>
              <th>Broker type</th>
              <th>Default</th>
              <th>Accounts</th>
              <th>Watchlist</th>
              <th>Total cash</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const m = mergeRow(row);
              return (
                <tr key={row._id}>
                  <td>
                    <input
                      className="crud-input"
                      value={m.name}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row._id]: { ...prev[row._id], name: e.target.value }
                        }))
                      }
                      aria-label="Portfolio name"
                    />
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <Link
                      className="login-xoptions-link font-semibold text-sm"
                      href={userSettingsHref(row.userId)}
                      title="Open user settings"
                    >
                      {row.userDisplayName || "User"}
                    </Link>
                    <Link
                      className="font-mono break-all opacity-75 hover:opacity-100 underline-offset-2 hover:underline"
                      href={userSettingsHref(row.userId)}
                      style={{ fontSize: "0.65rem", display: "block", marginTop: "0.12rem" }}
                      title="User id — same link as display name"
                    >
                      {row.userId}
                    </Link>
                    {row.userEmail ? (
                      <div className="status-text break-all" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
                        {row.userEmail}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className="text-xs align-top"
                    style={{
                      maxWidth: 200,
                      wordBreak: "break-word",
                      whiteSpace: "normal"
                    }}
                    title={row.tenantPortfolioOrgKey ?? ""}
                  >
                    {row.tenantPortfolioOrgKey ?? "—"}
                  </td>
                  <td>
                    <input
                      className="crud-input font-mono text-xs"
                      value={
                        draft(row._id).ext_broker_ref !== undefined
                          ? draft(row._id).ext_broker_ref ?? ""
                          : row.ext_broker_ref ?? ""
                      }
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row._id]: { ...prev[row._id], ext_broker_ref: e.target.value }
                        }))
                      }
                      aria-label="Tenant org ref"
                      placeholder="e.g. extBrokerName"
                    />
                  </td>
                  <td>
                    <select
                      className="crud-input text-xs"
                      value={
                        (draft(row._id).broker_type !== undefined
                          ? draft(row._id).broker_type
                          : row.broker_type) ?? ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setEdits((prev) => ({
                          ...prev,
                          [row._id]: {
                            ...prev[row._id],
                            broker_type: v === "" ? null : v
                          }
                        }));
                      }}
                      aria-label="Broker type"
                    >
                      <option value="">—</option>
                      {rowBrokerSelectOptions(
                        draft(row._id).broker_type !== undefined ? draft(row._id).broker_type : row.broker_type
                      ).map((bt) => (
                        <option key={bt.type} value={bt.type}>
                          {bt.name} ({bt.type})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`default-portfolio-${row.userId}`}
                        checked={m.isDefault}
                        onChange={() => selectDefaultForUser(row.userId, row._id)}
                        aria-label={`Default portfolio for user ${row.userDisplayName}`}
                      />
                      {m.isDefault ? "Yes" : "No"}
                    </label>
                  </td>
                  <td>
                    <Link
                      className="login-xoptions-link"
                      href={`/admin/portfolios/${encodeURIComponent(row._id)}/accounts`}
                      title="Manage accounts"
                    >
                      {row.accountCount}
                    </Link>
                  </td>
                  <td>
                    <Link
                      className="login-xoptions-link"
                      href={`/admin/portfolios/${encodeURIComponent(row._id)}/watchlist`}
                      title="Manage watchlist"
                    >
                      Open
                    </Link>
                  </td>
                  <td>{money.format(row.totalCashBalance)}</td>
                  <td className="text-xs">{new Date(row.updatedAt).toLocaleString()}</td>
                  <td>
                    <div className="tool-row" style={{ gap: "0.35rem", flexWrap: "wrap", maxWidth: 420 }}>
                      <Link
                        className="cta cta-secondary text-xs"
                        href={`/admin/portfolios/${encodeURIComponent(row._id)}/accounts`}
                        title="Manage accounts for this portfolio"
                      >
                        Accounts
                      </Link>
                      <Link
                        className="cta cta-secondary text-xs"
                        href={`/admin/portfolios/${encodeURIComponent(row._id)}/watchlist`}
                        title="Manage watchlist"
                      >
                        Watchlist
                      </Link>
                      <Link
                        className="cta cta-secondary text-xs"
                        href={`/admin/portfolios/${encodeURIComponent(row._id)}/tasks`}
                        title="View tasks"
                      >
                        Tasks
                      </Link>
                      <Link
                        className="cta cta-secondary text-xs"
                        href={`/admin/portfolios/${encodeURIComponent(row._id)}/alerts`}
                        title="Manage alerts"
                      >
                        Alerts
                      </Link>
                      <Link
                        className="cta cta-secondary text-xs"
                        href={`/admin/portfolios/${encodeURIComponent(row._id)}/scoring`}
                        title="Edit scoring factors"
                      >
                        Scoring
                      </Link>
                      <Link
                        className="cta cta-secondary text-xs"
                        href={`/admin/portfolios/${encodeURIComponent(row._id)}/recommendations`}
                        title="View recommendations"
                      >
                        Recs
                      </Link>
                      <Link
                        className="cta cta-secondary text-xs"
                        href={`/admin/portfolios/${encodeURIComponent(row._id)}/delivery-channels`}
                        title="Manage delivery channels"
                      >
                        Delivery
                      </Link>
                      <button
                        type="button"
                        className="cta cta-secondary text-xs"
                        title="Delete portfolio and all linked data"
                        onClick={() => void deleteRow(row)}
                      >
                        <DeleteIcon className="crud-icon" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="surface-card xf-widget section-card"
        style={{ marginTop: "1.25rem", padding: "1rem", borderStyle: "dashed" }}
      >
        <h4 className="text-sm font-semibold" style={{ marginBottom: "0.5rem" }}>
          <AddIcon className="crud-icon" /> New portfolio
        </h4>
        <div className="stack-gap" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            User ID (core user)
            <input
              className="crud-input font-mono text-xs"
              value={createUserId}
              onChange={(e) => setCreateUserId(e.target.value)}
              placeholder="hex user id"
            />
          </label>
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Display name
            <input
              className="crud-input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Secondary book"
            />
          </label>
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Broker type (optional)
            <select
              className="crud-input text-xs"
              value={createBrokerType}
              onChange={(e) => setCreateBrokerType(e.target.value === "" ? "" : e.target.value)}
            >
              <option value="">—</option>
              {brokerCatalog.map((bt) => (
                <option key={bt.type} value={bt.type}>
                  {bt.name} ({bt.type})
                </option>
              ))}
            </select>
          </label>
          <label className="status-text" style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            <input type="checkbox" checked={createDefault} onChange={(e) => setCreateDefault(e.target.checked)} />
            Set as user default
          </label>
          <button type="button" className="cta cta-primary" onClick={() => void createPortfolio()}>
            Create
          </button>
        </div>
      </div>
    </article>
  );
}
