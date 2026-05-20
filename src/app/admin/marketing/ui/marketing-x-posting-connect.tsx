"use client";

import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type StatusPayload = {
  data: {
    linked: boolean;
    username: string | null;
    xUserId: string | null;
    adsAccountId: string | null;
    updatedAt: string | null;
    grantedScopes: string[];
    postingLikelyBlocked: boolean | null;
  };
};

export type MarketingXPostingConnectPanelProps = {
  /** `next` query for OAuth return redirect (safe path only). */
  returnPath?: string;
};

export function MarketingXPostingConnectPanel({ returnPath = "/admin/marketing" }: MarketingXPostingConnectPanelProps) {
  const [hint, setHint] = useState<string>("Loading posting OAuth status…");
  const [linked, setLinked] = useState<boolean | null>(null);
  const [xUserId, setXUserId] = useState<string>("");
  const [adsAccountId, setAdsAccountId] = useState<string>("");
  const [savingIds, setSavingIds] = useState(false);
  const [idsStatus, setIdsStatus] = useState<string>("");

  const load = useCallback(async () => {
    await Promise.resolve();
    try {
      const payload = await parseJson<StatusPayload>(await fetch("/api/admin/marketing/x-posting/status"));
      setLinked(payload.data.linked);
      setXUserId(payload.data.xUserId || "");
      setAdsAccountId(payload.data.adsAccountId || "");

      if (payload.data.linked && payload.data.username) {
        let msg = `Connected for posting as @${payload.data.username}. Scheduled and test posts use this account.`;
        if (payload.data.xUserId) {
          msg += ` X user id: ${payload.data.xUserId}.`;
        }
        if (payload.data.adsAccountId) {
          msg += ` Ads account: ${payload.data.adsAccountId}.`;
        }
        if (payload.data.postingLikelyBlocked === true) {
          msg +=
            " Stored OAuth scopes do not include tweet.write — POST /2/tweets will return 403 until the X app is **Read and write** in the Developer Portal (not Read only), then **Reconnect** here.";
        } else if (payload.data.postingLikelyBlocked === null && payload.data.grantedScopes.length === 0) {
          msg +=
            " OAuth scope list not stored yet — use **Reconnect** after Portal changes so we can verify tweet.write.";
        }
        setHint(msg);
      } else {
        setHint(
          "Not connected — connect the X account that should publish marketing and test posts (OAuth approval required)."
        );
      }
      setIdsStatus("");
    } catch (error) {
      setHint(error instanceof Error ? error.message : "Failed to load status");
      setLinked(null);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("posting_oauth");
    if (oauth === "connected") {
      const id = window.setTimeout(() => {
        void load();
        const url = new URL(window.location.href);
        url.searchParams.delete("posting_oauth");
        url.searchParams.delete("posting_username");
        url.searchParams.delete("posting_oauth_detail");
        window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      }, 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [load]);

  async function disconnect() {
    if (!window.confirm("Disconnect X posting OAuth for this environment? Scheduled posts to X will fail until you reconnect.")) {
      return;
    }
    try {
      await parseJson<{ data: { disconnected: boolean } }>(
        await fetch("/api/admin/marketing/x-posting/oauth/disconnect", { method: "POST" })
      );
      await load();
    } catch (error) {
      setHint(error instanceof Error ? error.message : "Disconnect failed");
    }
  }

  async function saveTargetIds() {
    setSavingIds(true);
    setIdsStatus("Saving X user / ads ids…");
    try {
      await parseJson(
        await fetch("/api/admin/marketing/x-posting/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            xUserId: xUserId.trim() || null,
            adsAccountId: adsAccountId.trim() || null
          })
        })
      );
      setIdsStatus("Saved. These ids are used for X Ads campaign creation and scoping.");
      await load();
    } catch (error) {
      setIdsStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingIds(false);
    }
  }

  const startHref = `/api/admin/marketing/x-posting/oauth/start?next=${encodeURIComponent(returnPath)}`;

  return (
    <article className="surface-card xf-widget section-card">
      <h3 className="mt-0">Connect X for posting</h3>
      <p className="text-sm text-[var(--xf-text-muted)]">{hint}</p>

      <div className="tool-row mt-3 flex-wrap">
        <a className="cta cta-primary" href={startHref}>
          {linked ? "Reconnect X for posting" : "Connect X for posting"}
        </a>
        {linked ? (
          <button className="cta cta-secondary" type="button" onClick={() => void disconnect()}>
            Disconnect posting OAuth
          </button>
        ) : null}
        <button className="cta cta-secondary" type="button" onClick={() => void load()}>
          Refresh status
        </button>
      </div>

      <div className="mt-4 border-t border-[var(--xf-border-subtle)] pt-3">
        <p className="text-sm font-semibold">X targeting for ads &amp; posting</p>
        <p className="text-xs text-[var(--xf-text-muted)]">
          Enter the numeric X user id (from <code>/2/users/me</code> or your profile) and the X Ads account id you want to use when creating ad campaigns. These are persisted independently of the OAuth tokens and are used by the X Ads integration below.
        </p>
        <div className="tool-row mt-2 flex-wrap" style={{ gap: "0.5rem" }}>
          <input
            className="crud-input text-sm font-mono"
            style={{ minWidth: "12rem" }}
            placeholder="X user id (numeric, e.g. 1234567890123456789)"
            value={xUserId}
            onChange={(e) => setXUserId(e.target.value)}
            disabled={savingIds}
          />
          <input
            className="crud-input text-sm font-mono"
            style={{ minWidth: "10rem" }}
            placeholder="Ads account id (e.g. 18ce54d4x5t)"
            value={adsAccountId}
            onChange={(e) => setAdsAccountId(e.target.value)}
            disabled={savingIds}
          />
          <button
            type="button"
            className="tiny-button"
            onClick={() => void saveTargetIds()}
            disabled={savingIds}
          >
            {savingIds ? "Saving…" : "Save X user / ads ids"}
          </button>
        </div>
        {idsStatus ? <p className="status-text mt-1">{idsStatus}</p> : null}
      </div>

      <p className="mt-3 text-xs text-[var(--xf-text-muted)]">
        Legacy: set <code className="font-mono">X_OAUTH_REFRESH_TOKEN</code> in env instead of using Connect (not recommended).
        For Ads API access the connected app must have the Ads API product enabled and the X user must have access to the target ads account in X Ads Manager.
      </p>
    </article>
  );
}
