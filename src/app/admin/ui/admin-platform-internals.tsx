"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { AdminOpsSummaryPanel } from "@/app/admin/ui/admin-ops-summary-panel";
import { DataPlaneHealthPanel } from "@/app/admin/ui/data-plane-health-panel";
import { TenantUxFailClosedDrillToggle } from "@/app/admin/ui/tenant-ux-fail-closed-drill-toggle";
import { TenantUxObservabilityPanel } from "@/app/admin/ui/tenant-ux-observability-panel";

type AdminPlatformInternalsProps = {
  /** When true, panels render expanded (dedicated platform-health page). */
  defaultOpen?: boolean;
  showFullPageLink?: boolean;
};

export function AdminPlatformInternals({
  defaultOpen = false,
  showFullPageLink = true
}: AdminPlatformInternalsProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const triggerId = useId();

  if (defaultOpen) {
    return (
      <section className="panel stack-gap admin-platform-internals">
        <div className="panel-header">
          <h2>Platform internals</h2>
          <p>Ops summary, data-plane health, and tenant UX enforcement drills.</p>
        </div>
        <AdminOpsSummaryPanel />
        <DataPlaneHealthPanel />
        <article className="surface-card xf-widget section-card stack-gap">
          <h3 className="mt-0">Tenant UX enforcement drills</h3>
          <p className="status-text m-0">
            Keep production fail-open defaults for soak while allowing targeted fail-closed simulation from admin.
          </p>
          <TenantUxFailClosedDrillToggle />
        </article>
        <TenantUxObservabilityPanel />
      </section>
    );
  }

  return (
    <section className="panel stack-gap admin-platform-internals">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="admin-platform-internals__trigger"
        id={triggerId}
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <strong className="admin-platform-internals__trigger-title">Platform internals & health</strong>
          <span className="admin-platform-internals__trigger-sub">
            Ops summary, Mongo/Redis/backend probes, data-plane registry, tenant UX drills
          </span>
        </span>
        <span className="status-badge status-pending">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="stack-gap" id={panelId} role="region" aria-labelledby={triggerId}>
          {showFullPageLink ? (
            <p className="status-text m-0">
              <Link className="underline font-medium" href="/admin/platform-health">
                Open full platform health page
              </Link>
            </p>
          ) : null}
          <AdminOpsSummaryPanel />
          <DataPlaneHealthPanel />
          <article className="surface-card xf-widget section-card stack-gap">
            <h3 className="mt-0">Tenant UX enforcement drills</h3>
            <TenantUxFailClosedDrillToggle />
          </article>
          <TenantUxObservabilityPanel />
        </div>
      ) : null}
    </section>
  );
}
