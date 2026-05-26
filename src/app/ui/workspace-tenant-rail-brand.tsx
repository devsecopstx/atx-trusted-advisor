"use client";

import Link from "next/link";

import { AtxFinanceMark } from "@/app/ui/atxfinance-logo";
import { useTenantShellBranding } from "@/app/ui/tenant-branding-context";
import { resolveTenantDeskDisplayLabel } from "@/lib/tenant-desk-display-label";

type WorkspaceTenantRailBrandProps = {
  href: string;
  /** Expanded rail shows name + tagline; collapsed shows logo/initials only. */
  expanded: boolean;
};

function tenantInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/**
 * Workspace rail header lockup: tenant logo, `core_tenants.name` / `xchat_brandname`, tagline.
 * Falls back to product mark when tenant branding is unset.
 */
export function WorkspaceTenantRailBrand({ href, expanded }: WorkspaceTenantRailBrandProps) {
  const branding = useTenantShellBranding();
  const desk = resolveTenantDeskDisplayLabel(branding);

  if (!desk) {
    return (
      <Link
        aria-label={expanded ? "Workspace home" : "aTx Finance — workspace home"}
        className="workspace-product-sidebar__brand"
        href={href}
        title="Workspace home"
      >
        <AtxFinanceMark className="shrink-0" size={expanded ? 22 : 20} />
        {expanded ? <span className="workspace-product-sidebar__brand-finance">Finance</span> : null}
      </Link>
    );
  }

  return (
    <Link
      aria-label={`${desk.primary} workspace`}
      className="workspace-product-sidebar__brand workspace-product-sidebar__brand--tenant"
      href={href}
      title={desk.primary}
    >
      {desk.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant logo URL
        <img
          alt=""
          className="workspace-product-sidebar__tenant-logo"
          height={expanded ? 28 : 24}
          src={desk.logoUrl}
          width={expanded ? 28 : 24}
        />
      ) : (
        <span aria-hidden className="workspace-product-sidebar__tenant-initials">
          {tenantInitials(desk.primary)}
        </span>
      )}
      {expanded ? (
        <span className="workspace-product-sidebar__tenant-desk min-w-0">
          <span className="workspace-product-sidebar__tenant-desk-name">{desk.primary}</span>
          {desk.tagline ? (
            <span className="workspace-product-sidebar__tenant-desk-tagline">{desk.tagline}</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
