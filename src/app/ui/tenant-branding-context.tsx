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
 * Also sets `--xf-tenant-accent` on `document.documentElement` for CSS hooks.
 */
export function TenantBrandingProvider({ value, children }: TenantBrandingProviderProps) {
  const stable = useMemo(() => value, [value]);

  useEffect(() => {
    const root = document.documentElement;
    const accent = stable?.accentColor?.trim();
    if (accent) {
      root.style.setProperty("--xf-tenant-accent", accent);
    } else {
      root.style.removeProperty("--xf-tenant-accent");
    }
    return () => {
      root.style.removeProperty("--xf-tenant-accent");
    };
  }, [stable?.accentColor]);

  return <TenantBrandingContext.Provider value={stable}>{children}</TenantBrandingContext.Provider>;
}

export function useTenantShellBranding(): TenantShellBranding | null {
  return useContext(TenantBrandingContext);
}
