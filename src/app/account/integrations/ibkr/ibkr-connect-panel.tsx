"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type StatusPayload = {
  enabled: boolean;
  paperTrading: boolean;
  gatewayConfigured: boolean;
  consentRecorded: boolean;
  sessionPresent: boolean;
  sessionBodyAllowed: boolean;
  consentSummary: string | null;
  sessionCookieMaxAgeSec?: number;
  sessionIssuedAtMs?: number | null;
  reauthRecommended?: boolean;
  oauthBrokerSsoAvailable?: boolean;
  sessionHint?: string | null;
};

export function IbkrConnectPanel() {
  const [, startSnapshotTransition] = useTransition();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [accountsMsg, setAccountsMsg] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; displayLabel: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotSummary, setSnapshotSummary] = useState<unknown>(null);
  const [snapshotPositions, setSnapshotPositions] = useState<unknown>(null);
  const [snapshotOrders, setSnapshotOrders] = useState<unknown>(null);
  const [snapshotExecutions, setSnapshotExecutions] = useState<unknown>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const summaryText = useMemo(
    () => (snapshotSummary != null ? JSON.stringify(snapshotSummary, null, 2) : ""),
    [snapshotSummary]
  );
  const positionsText = useMemo(
    () => (snapshotPositions != null ? JSON.stringify(snapshotPositions, null, 2) : ""),
    [snapshotPositions]
  );
  const ordersText = useMemo(
    () => (snapshotOrders != null ? JSON.stringify(snapshotOrders, null, 2) : ""),
    [snapshotOrders]
  );
  const executionsText = useMemo(
    () => (snapshotExecutions != null ? JSON.stringify(snapshotExecutions, null, 2) : ""),
    [snapshotExecutions]
  );

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/integrations/ibkr/status", { cache: "no-store" });
      const json = (await res.json()) as { data?: StatusPayload; error?: string };
      if (!res.ok) {
        setLoadError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setStatus(json.data ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "load_failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onConsent = async (accepted: boolean) => {
    setBusy(true);
    setAccountsMsg(null);
    try {
      const res = await fetch("/api/integrations/ibkr/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAccountsMsg(json.error ?? `consent ${res.status}`);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onSaveSession = async () => {
    setBusy(true);
    setAccountsMsg(null);
    try {
      const res = await fetch("/api/integrations/ibkr/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientPortalCookie: cookieInput.trim() })
      });
      const json = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        setAccountsMsg([json.error, json.hint].filter(Boolean).join(" — ") || `session ${res.status}`);
        return;
      }
      setCookieInput("");
      await refresh();
      setAccountsMsg("Session stored (httpOnly cookie).");
    } finally {
      setBusy(false);
    }
  };

  const onClearSession = async () => {
    setBusy(true);
    setAccountsMsg(null);
    try {
      await fetch("/api/integrations/ibkr/session", { method: "DELETE" });
      await refresh();
      setAccountsMsg("Session cleared.");
    } finally {
      setBusy(false);
    }
  };

  const onListAccounts = async () => {
    setBusy(true);
    setAccountsMsg(null);
    try {
      const res = await fetch("/api/integrations/ibkr/accounts", { cache: "no-store" });
      const json = (await res.json()) as {
        data?: { accounts: Array<{ id: string; displayLabel: string }> };
        error?: string;
        detail?: string;
        hint?: string;
      };
      if (!res.ok) {
        setAccounts([]);
        setSelectedAccountId("");
        setAccountsMsg(
          [json.error, json.detail, json.hint].filter(Boolean).join(" — ") || `accounts ${res.status}`
        );
        return;
      }
      const rows = json.data?.accounts ?? [];
      setAccounts(rows);
      if (rows.length > 0 && !selectedAccountId) {
        setSelectedAccountId(rows[0]!.id);
      }
      setAccountsMsg(
        rows.length === 0
          ? "No accounts returned."
          : rows.map((a) => `${a.displayLabel} (${a.id})`).join(" · ")
      );
    } finally {
      setBusy(false);
    }
  };

  const loadReadOnlySnapshot = async () => {
    if (!selectedAccountId.trim()) {
      setSnapshotError("Select an account first (use Test: list accounts).");
      return;
    }
    const id = encodeURIComponent(selectedAccountId.trim());
    setSnapshotBusy(true);
    setSnapshotError(null);
    setSnapshotSummary(null);
    setSnapshotPositions(null);
    setSnapshotOrders(null);
    setSnapshotExecutions(null);
    try {
      const res = await fetch(`/api/integrations/ibkr/accounts/${id}/snapshot?days=7`, { cache: "no-store" });
      const j = (await res.json()) as {
        error?: string;
        detail?: string;
        hint?: string;
        data?: {
          summary?: unknown;
          positions?: unknown;
          orders?: unknown;
          executions?: unknown;
        };
      };
      if (!res.ok) {
        setSnapshotError([j.error, j.detail, j.hint].filter(Boolean).join(" — ") || `HTTP ${res.status}`);
        return;
      }
      const d = j.data;
      startSnapshotTransition(() => {
        if (d?.summary) {
          setSnapshotSummary(d.summary);
        }
        if (d?.positions) {
          setSnapshotPositions(d.positions);
        }
        if (d?.orders) {
          setSnapshotOrders(d.orders);
        }
        if (d?.executions) {
          setSnapshotExecutions(d.executions);
        }
      });
    } finally {
      setSnapshotBusy(false);
    }
  };

  if (loadError) {
    return (
      <p className="font-mono text-sm text-red-400" data-testid="ibkr-load-error">
        {loadError}
      </p>
    );
  }

  if (!status) {
    return <p className="font-mono text-sm text-[var(--xf-text-muted,#94a3b8)]">Loading…</p>;
  }

  if (!status.enabled) {
    return (
      <div className="space-y-2 rounded-lg border border-[var(--xf-border-subtle,#1f2937)] bg-[var(--xf-surface-800,#0f172a)] p-4">
        <p className="font-mono text-sm text-[var(--xf-text-muted,#94a3b8)]">
          IBKR integration is disabled for this deployment (<code className="text-[var(--xf-gain-green,#39ff14)]">IBKR_ENABLED</code>
          ).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--xf-border-subtle,#1f2937)] bg-[var(--xf-surface-800,#0f172a)] p-4">
        <h2 className="text-lg font-semibold text-[var(--xf-text-primary,#f1f5f9)]">IBKR Client Portal</h2>
        <p className="mt-2 font-mono text-xs text-[var(--xf-text-muted,#94a3b8)]">
          {status.consentSummary ?? "Phased rollout — paper-first when trading ships."} Mode:{" "}
          <span className="text-[var(--xf-gain-green,#39ff14)]">
            {status.paperTrading ? "paper preferred" : "live-capable (gated later)"}
          </span>
          . Gateway URL configured: {status.gatewayConfigured ? "yes" : "no"}.
        </p>
        {status.oauthBrokerSsoAvailable === false ? (
          <p className="mt-2 font-mono text-[10px] text-[var(--xf-text-muted,#64748b)]">
            Broker OAuth / refresh: <span className="text-amber-400/90">not available in-app</span> — use gateway
            cookie paste (or operator env). Session cookie max-age ~{status.sessionCookieMaxAgeSec ?? 86400}s.
            {status.sessionIssuedAtMs ? (
              <>
                {" "}
                Stored session clock: {new Date(status.sessionIssuedAtMs).toISOString()}.
              </>
            ) : null}
          </p>
        ) : null}
        {status.sessionHint ? (
          <p className="mt-1 font-mono text-[10px] text-[var(--xf-text-muted,#64748b)]">{status.sessionHint}</p>
        ) : null}
        {status.reauthRecommended ? (
          <p className="mt-2 font-mono text-[10px] text-amber-400/90">
            Session is stale. Re-paste a fresh Client Portal cookie before loading accounts/snapshot.
          </p>
        ) : null}
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--xf-text-muted,#64748b)]">
          Not financial advice. Educational use only.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!status.consentRecorded ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-md bg-[var(--xf-gain-green,#39ff14)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            onClick={() => void onConsent(true)}
          >
            I agree — connect IBKR
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-[var(--xf-border-subtle,#334155)] px-4 py-2 text-sm text-[var(--xf-text-primary,#f1f5f9)] disabled:opacity-50"
            onClick={() => void onConsent(false)}
          >
            Withdraw consent
          </button>
        )}
      </div>

      {status.sessionBodyAllowed ? (
        <div className="space-y-2 rounded-lg border border-[var(--xf-border-subtle,#1f2937)] bg-[var(--xf-surface-800,#0f172a)] p-4">
          <h3 className="text-sm font-semibold text-[var(--xf-text-primary,#f1f5f9)]">Client Portal session</h3>
          <p className="font-mono text-xs text-[var(--xf-text-muted,#94a3b8)]">
            After logging into your local IBKR Client Portal gateway, paste the full <code>Cookie</code> header
            value your browser sends to the gateway. It is sealed and stored in an httpOnly cookie — not in Mongo.
          </p>
          <textarea
            className="min-h-[88px] w-full rounded-md border border-[var(--xf-border-subtle,#334155)] bg-black/40 p-2 font-mono text-xs text-[var(--xf-text-primary,#f1f5f9)]"
            placeholder="e.g. api_auth=…"
            value={cookieInput}
            onChange={(e) => setCookieInput(e.target.value)}
            disabled={busy || !status.consentRecorded}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !status.consentRecorded || !cookieInput.trim()}
              className="rounded-md bg-[var(--xf-gain-green,#39ff14)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
              onClick={() => void onSaveSession()}
            >
              Save session
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-[var(--xf-border-subtle,#334155)] px-3 py-1.5 text-xs text-[var(--xf-text-primary,#f1f5f9)] disabled:opacity-50"
              onClick={() => void onClearSession()}
            >
              Clear session
            </button>
            <button
              type="button"
              disabled={busy || !status.consentRecorded}
              className="rounded-md border border-[var(--xf-border-subtle,#334155)] px-3 py-1.5 text-xs text-[var(--xf-gain-green,#39ff14)] disabled:opacity-50"
              onClick={() => void onListAccounts()}
            >
              Test: list accounts
            </button>
          </div>
        </div>
      ) : (
        <p className="font-mono text-xs text-[var(--xf-text-muted,#94a3b8)]">
          Session paste is disabled in this environment. Use{" "}
          <code className="text-[var(--xf-gain-green,#39ff14)]">IBKR_ALLOW_SESSION_COOKIE_BODY=true</code> or local
          development, or operator env session (see docs).
        </p>
      )}

      {accountsMsg ? (
        <p className="font-mono text-xs text-[var(--xf-text-muted,#94a3b8)]" data-testid="ibkr-accounts-msg">
          {accountsMsg}
        </p>
      ) : null}

      {status.consentRecorded && accounts.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-[var(--xf-border-subtle,#1f2937)] bg-[var(--xf-surface-800,#0f172a)] p-4">
          <h3 className="text-sm font-semibold text-[var(--xf-text-primary,#f1f5f9)]">Read-only portfolio snapshot</h3>
          <p className="font-mono text-[10px] text-[var(--xf-text-muted,#64748b)]">
            Phase 3 — summary, positions, orders, and executions (IBKR trades). No order placement. Phase 4+ adds market
            data / contracts; Phase 5 adds confirm/place (gated).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="font-mono text-xs text-[var(--xf-text-muted,#94a3b8)]">
              Account{" "}
              <select
                className="ml-1 rounded border border-[var(--xf-border-subtle,#334155)] bg-black/40 px-2 py-1 text-[var(--xf-text-primary,#f1f5f9)]"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={snapshotBusy}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayLabel} ({a.id})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={snapshotBusy || !status.sessionPresent}
              className="rounded-md bg-[var(--xf-gain-green,#39ff14)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
              onClick={() => void loadReadOnlySnapshot()}
            >
              {snapshotBusy ? "Loading…" : "Load snapshot"}
            </button>
          </div>
          {snapshotError ? (
            <p className="font-mono text-xs text-red-400" data-testid="ibkr-snapshot-error">
              {snapshotError}
            </p>
          ) : null}
          {snapshotSummary ? (
            <details open className="rounded border border-[var(--xf-border-subtle,#334155)] bg-black/30 p-2">
              <summary className="cursor-pointer font-mono text-xs text-[var(--xf-gain-green,#39ff14)]">Summary</summary>
              <pre className="mt-2 max-h-48 overflow-auto font-mono text-[10px] text-[var(--xf-text-muted,#94a3b8)]">
                {summaryText}
              </pre>
            </details>
          ) : null}
          {snapshotPositions ? (
            <details className="rounded border border-[var(--xf-border-subtle,#334155)] bg-black/30 p-2">
              <summary className="cursor-pointer font-mono text-xs text-[var(--xf-gain-green,#39ff14)]">Positions</summary>
              <pre className="mt-2 max-h-48 overflow-auto font-mono text-[10px] text-[var(--xf-text-muted,#94a3b8)]">
                {positionsText}
              </pre>
            </details>
          ) : null}
          {snapshotOrders ? (
            <details className="rounded border border-[var(--xf-border-subtle,#334155)] bg-black/30 p-2">
              <summary className="cursor-pointer font-mono text-xs text-[var(--xf-gain-green,#39ff14)]">Orders</summary>
              <pre className="mt-2 max-h-48 overflow-auto font-mono text-[10px] text-[var(--xf-text-muted,#94a3b8)]">
                {ordersText}
              </pre>
            </details>
          ) : null}
          {snapshotExecutions ? (
            <details className="rounded border border-[var(--xf-border-subtle,#334155)] bg-black/30 p-2">
              <summary className="cursor-pointer font-mono text-xs text-[var(--xf-gain-green,#39ff14)]">
                Executions (trades)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto font-mono text-[10px] text-[var(--xf-text-muted,#94a3b8)]">
                {executionsText}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
