"use client";

import { useCallback } from "react";

import { isPathAllowedByTenantUxRoutes } from "@/app/ui/tenant-ux-nav-visibility";
import { useTenantUxPolicy } from "@/app/ui/use-tenant-ux-policy";

/**
 * Tenant UX nav hints: hide links the edge would deny (edge remains authoritative).
 * When `visiblePathPrefixes` is passed from the server, it wins over the client `/me/role` fetch.
 */
export function useTenantUxNavVisibility(visiblePathPrefixes?: string[] | null) {
  const { allowedRoutes, defaultLanding } = useTenantUxPolicy();
  const effective = visiblePathPrefixes ?? allowedRoutes;

  const isPathVisible = useCallback(
    (pathPrefix: string) => {
      if (!effective) {
        return true;
      }
      if (pathPrefix === "/resources") {
        return isPathAllowedByTenantUxRoutes("/resources", effective);
      }
      return isPathAllowedByTenantUxRoutes(pathPrefix, effective);
    },
    [effective]
  );

  const resolvePreferredHomeHref = useCallback(() => {
    if (!effective) {
      return "/portfolios";
    }
    if (isPathAllowedByTenantUxRoutes("/portfolios", effective)) {
      return "/portfolios";
    }
    if (isPathAllowedByTenantUxRoutes("/xchat", effective)) {
      return "/xchat";
    }
    return defaultLanding.startsWith("/") ? defaultLanding : "/xchat";
  }, [effective, defaultLanding]);

  const isAccountTasksVisible = useCallback(() => {
    if (!effective) {
      return true;
    }
    return isPathAllowedByTenantUxRoutes("/account/tasks", effective);
  }, [effective]);

  const isWorkspaceAutomationsVisible = useCallback(() => {
    if (!effective) {
      return true;
    }
    return isPathAllowedByTenantUxRoutes("/workspace/tasks", effective);
  }, [effective]);

  return {
    allowedRoutes: effective,
    defaultLanding,
    isPathVisible,
    resolvePreferredHomeHref,
    isAccountTasksVisible,
    isWorkspaceAutomationsVisible
  };
}
