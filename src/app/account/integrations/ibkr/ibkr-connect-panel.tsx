"use client";

import { useCallback, useEffect, useState } from "react";

type StatusPayload = {
  enabled: boolean;
  paperTrading: boolean;
  gatewayConfigured: boolean;
  consentRecorded: boolean;
  sessionPresent: boolean;
  sessionBodyAllowed: boolean;
  consentSummary: string | null;
};

export function IbkrConnectPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [accountsMsg, setAccountsMsg] = useState<string | null>(null);

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
      };
      if (!res.ok) {
        setAccountsMsg([json.error, json.detail].filter(Boolean).join(": ") || `accounts ${res.status}`);
        return;
      }
      const rows = json.data?.accounts ?? [];
      setAccountsMsg(
        rows.length === 0
          ? "No accounts returned."
          : rows.map((a) => `${a.displayLabel} (${a.id})`).join(" · ")
      );
    } finally {
      setBusy(false);
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
    </div>
  );
}
