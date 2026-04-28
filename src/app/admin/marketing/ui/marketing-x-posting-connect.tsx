"use client";

import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type StatusPayload = {
  data: {
    linked: boolean;
    username: string | null;
    updatedAt: string | null;
  };
};

export type MarketingXPostingConnectPanelProps = {
  /** `next` query for OAuth return redirect (safe path only). */
  returnPath?: string;
};

export function MarketingXPostingConnectPanel({ returnPath = "/admin/marketing" }: MarketingXPostingConnectPanelProps) {
  const [hint, setHint] = useState<string>("Loading posting OAuth status…");
  const [linked, setLinked] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    try {
      const payload = await parseJson<StatusPayload>(await fetch("/api/admin/marketing/x-posting/status"));
      setLinked(payload.data.linked);
      if (payload.data.linked && payload.data.username) {
        setHint(`Connected for posting as @${payload.data.username}. Scheduled and test posts use this account.`);
      } else {
        setHint(
          "Not connected — connect the X account that should publish marketing and test posts (OAuth approval required)."
        );
      }
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

  const startHref = `/api/admin/marketing/x-posting/oauth/start?next=${encodeURIComponent(returnPath)}`;

  return (
    <article className="surface-card xf-widget section-card">
      <h3 className="mt-0">Connect X for posting</h3>
      <p className="text-sm text-[var(--xf-text-muted)]">{hint}</p>
      {linked === false ? (
        <p className="text-xs text-[var(--xf-text-muted)]">
          Use the same OAuth callback as Sign in with X — whitelist{" "}
          <code className="rounded bg-[var(--xf-surface-900)] px-1 py-0.5 font-mono">
            …/api/auth/x/callback
          </code>{" "}
          (or your <code className="font-mono">X_OAUTH_CALLBACK_URL</code> in production). No separate posting URL.
          Posting scopes: <code className="font-mono">tweet.write offline.access users.read</code>.
        </p>
      ) : null}
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
      <p className="mt-2 text-xs text-[var(--xf-text-muted)]">
        Legacy: set <code className="font-mono">X_OAUTH_REFRESH_TOKEN</code> in env instead of using Connect (not
        recommended).
      </p>
    </article>
  );
}
