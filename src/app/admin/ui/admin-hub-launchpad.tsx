"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { ADMIN_HUB_ITEM_ICONS, AdminHubNavIcon } from "@/app/admin/ui/admin-hub-nav-icons";
import {
    ADMIN_FUNCTION_GROUPS,
    ADMIN_HUB_GROUP_ACCENTS,
    getAdminHubLaunchpadCtas,
    type AdminFunctionGroup
} from "@/app/admin/ui/admin-hub-sections";
import { AdminPlatformInternals } from "@/app/admin/ui/admin-platform-internals";
import type { AdminHubSummaryResponse } from "@/lib/admin-hub-summary-contract";

type AdminHubLaunchpadProps = {
  tenantName?: string | null;
  tenantSlug?: string | null;
  tenantAccent?: string | null;
  sessionTenantId: string;
  effectiveTenantId: string | null;
  tenantMismatch: boolean;
};

function groupBadge(
  groupTitle: string,
  summary: AdminHubSummaryResponse | null
): string | null {
  if (!summary) {
    return null;
  }
  if (groupTitle === "Desk & operations") {
    const parts: string[] = [];
    if (summary.pendingAccessRequests > 0) {
      parts.push(`${summary.pendingAccessRequests} pending`);
    }
    if (summary.failedTaskRuns24h > 0) {
      parts.push(`${summary.failedTaskRuns24h} failed run${summary.failedTaskRuns24h === 1 ? "" : "s"}`);
    }
    if (summary.batchJobsNeedingAttention > 0) {
      parts.push(`${summary.batchJobsNeedingAttention} batch active`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  return null;
}

function HubGroupCard({
  group,
  accent,
  badge,
  index
}: {
  group: AdminFunctionGroup;
  accent: string;
  badge: string | null;
  index: number;
}) {
  const ctas = getAdminHubLaunchpadCtas(group);

  return (
    <article
      className="admin-hub-card surface-card xf-widget"
      style={{ "--admin-hub-card-accent": accent } as CSSProperties}
    >
      <header className="admin-hub-card__header">
        <span className="admin-hub-card__index" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="admin-hub-card__titles">
          <h2 className="admin-hub-card__title">{group.title}</h2>
          {group.blurb ? <p className="admin-hub-card__blurb">{group.blurb}</p> : null}
        </div>
        {badge ? <span className="admin-hub-card__badge">{badge}</span> : null}
      </header>
      <div className="admin-hub-card__ctas">
        {ctas.map((item) => {
          const icon = item.icon ?? ADMIN_HUB_ITEM_ICONS[item.href];
          return (
            <Link
              key={item.href}
              className="admin-hub-card__cta"
              href={item.href}
              title={item.description}
            >
              {icon ? <AdminHubNavIcon className="admin-hub-card__cta-icon" icon={icon} /> : null}
              <span className="admin-hub-card__cta-label">{item.title}</span>
            </Link>
          );
        })}
      </div>
      {group.items.length > ctas.length ? (
        <p className="admin-hub-card__more status-text">
          +{group.items.length - ctas.length} more in the left rail
        </p>
      ) : null}
    </article>
  );
}

export function AdminHubLaunchpad({
  tenantName,
  tenantSlug,
  tenantAccent,
  sessionTenantId,
  effectiveTenantId,
  tenantMismatch
}: AdminHubLaunchpadProps) {
  const [summary, setSummary] = useState<AdminHubSummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch("/api/admin/hub/summary", { cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `HTTP ${String(res.status)}`);
      }
      setSummary((await res.json()) as AdminHubSummaryResponse);
    } catch (e) {
      setSummary(null);
      setSummaryError(e instanceof Error ? e.message : String(e));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const accentStyle = useMemo(() => {
    if (!tenantAccent?.trim()) {
      return undefined;
    }
    return {
      "--admin-hub-tenant-accent": tenantAccent.trim()
    } as React.CSSProperties;
  }, [tenantAccent]);

  return (
    <div className="admin-hub-launchpad stack-gap" style={accentStyle}>
      <section className="hero-card xf-noise-overlay admin-hub-hero">
        <div className="admin-hub-hero__row">
          <div>
            <p className="eyebrow">atxfinance core admin</p>
            <h1 className="hero-title">Admin Control Center</h1>
            <p className="hero-copy">
              Start here — quick stats, then open a desk area. Deep platform probes stay under{" "}
              <strong>Platform internals</strong> below.
            </p>
          </div>
          {tenantName ? (
            <div className="admin-hub-hero__tenant" title={tenantSlug ?? undefined}>
              <span className="admin-hub-hero__tenant-label">Workspace</span>
              <strong className="admin-hub-hero__tenant-name">{tenantName}</strong>
              {tenantSlug ? <span className="admin-hub-hero__tenant-slug">{tenantSlug}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="admin-hub-hero__actions tool-row flex-wrap">
          <Link className="cta cta-primary admin-hub-hero__xchat-cta" href="/xchat">
            <AdminHubNavIcon className="admin-hub-hero__xchat-icon" icon="chat" />
            Open xChat (admin)
          </Link>
          <Link className="cta cta-secondary" href="/admin/manage-users">
            Manage users
          </Link>
          <Link className="cta cta-secondary" href="/admin/portfolios">
            Portfolios
          </Link>
        </div>
      </section>

      <section className="admin-hub-quick-stats" aria-label="Quick stats">
        <div className="admin-hub-quick-stats__header">
          <h2 className="admin-hub-quick-stats__title">Quick stats</h2>
          <button className="tiny-button" disabled={summaryLoading} onClick={() => void loadSummary()} type="button">
            {summaryLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {summaryError ? <p className="status-text status-error">{summaryError}</p> : null}
        <div className="admin-hub-quick-stats__grid">
          {(summary?.quickStats ?? []).map((stat) => (
            <Link
              key={stat.id}
              className={`admin-hub-stat admin-hub-stat--${stat.emphasis ?? "default"}`}
              href={stat.href}
              title={stat.title}
            >
              <span className="admin-hub-stat__value">{summaryLoading ? "…" : stat.value}</span>
              <span className="admin-hub-stat__label">{stat.label}</span>
            </Link>
          ))}
          {summaryLoading && !summary ? (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="admin-hub-stat admin-hub-stat--loading" key={`skel-${i}`}>
                  <span className="admin-hub-stat__value">…</span>
                  <span className="admin-hub-stat__label">Loading</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </section>

      <section className="admin-hub-cards" aria-label="Admin areas">
        <h2 className="admin-hub-cards__heading">Areas</h2>
        <div className="admin-hub-cards__grid">
          {ADMIN_FUNCTION_GROUPS.map((group, index) => (
            <HubGroupCard
              key={group.title}
              accent={ADMIN_HUB_GROUP_ACCENTS[index] ?? ADMIN_HUB_GROUP_ACCENTS[0]}
              badge={groupBadge(group.title, summary)}
              group={group}
              index={index}
            />
          ))}
        </div>
      </section>

      <section className="panel stack-gap admin-hub-tenant-panel">
        <div className="panel-header">
          <h2>Tenant context</h2>
          <p>Session vs effective tenant for support and workspace limits.</p>
        </div>
        <dl className="grid gap-3 text-sm md:grid-cols-[minmax(8rem,auto)_1fr] md:gap-x-4">
          <dt className="font-medium text-[var(--xf-text-300)]">Session tenant id</dt>
          <dd>
            <code className="break-all rounded bg-[var(--xf-surface-800)] px-2 py-1 text-xs">{sessionTenantId}</code>
          </dd>
          <dt className="font-medium text-[var(--xf-text-300)]">Effective tenant id</dt>
          <dd>
            {effectiveTenantId ? (
              <code className="break-all rounded bg-[var(--xf-surface-800)] px-2 py-1 text-xs">{effectiveTenantId}</code>
            ) : (
              <span className="status-text status-error">Could not resolve a tenant in this database.</span>
            )}
          </dd>
        </dl>
        {tenantMismatch ? (
          <p className="status-text status-warn text-sm">
            Session tenant id does not match an existing row; the admin console falls back to the effective tenant above.
            Sign out and sign back in to refresh the session if needed.
          </p>
        ) : null}
      </section>

      <AdminPlatformInternals />
    </div>
  );
}
