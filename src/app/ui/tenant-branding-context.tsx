"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import type { TenantShellBranding } from "@/modules/identity/tenant-shell-branding";

const TenantBrandingContext = createContext<TenantShellBranding | null>(null);

type TenantBrandingProviderProps = {
  value: TenantShellBranding | null;
  children: ReactNode;
};

/**
 * Provides tenant shell branding from `core_tenants.tenantPreferences` (server-fetched in root layout).
 * Also sets tenant CSS variables on `document.documentElement` for hooks (`--xf-tenant-accent`, primary/secondary).
 */
export function TenantBrandingProvider({ value, children }: TenantBrandingProviderProps) {
  const stable = useMemo(() => value, [value]);

  useEffect(() => {
    const root = document.documentElement;
    const accent = stable?.accentColor?.trim();
    if (accent) {
      root.style.setProperty("--xf-tenant-accent", accent);
      root.style.setProperty("--xf-tenant-primary", accent);
      root.style.setProperty(
        "--xf-tenant-secondary",
        `color-mix(in srgb, ${accent} 58%, var(--xf-text-300))`
      );
    } else {
      root.style.removeProperty("--xf-tenant-accent");
      root.style.removeProperty("--xf-tenant-primary");
      root.style.removeProperty("--xf-tenant-secondary");
    }
    return () => {
      root.style.removeProperty("--xf-tenant-accent");
      root.style.removeProperty("--xf-tenant-primary");
      root.style.removeProperty("--xf-tenant-secondary");
    };
  }, [stable?.accentColor]);

  return <TenantBrandingContext.Provider value={stable}>{children}</TenantBrandingContext.Provider>;
}

export function useTenantShellBranding(): TenantShellBranding | null {
  return useContext(TenantBrandingContext);
}
