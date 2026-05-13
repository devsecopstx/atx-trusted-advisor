"use client";

import { useEffect, useState } from "react";

import { normalizePathnameForPolicy } from "@/modules/platform/app-user-product-prefixes";

type TenantUxPolicyPayload = {
  data: {
    allowedRoutes: string[];
    defaultLanding?: string;
  };
};

export function useTenantUxPolicy() {
  const [allowedRoutes, setAllowedRoutes] = useState<string[] | null>(null);
  const [defaultLanding, setDefaultLanding] = useState("/xchat");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/app-user/me/role", {
          credentials: "same-origin"
        });
        if (!res.ok) {
          return;
        }
        const payload = (await res.json()) as TenantUxPolicyPayload;
        if (!cancelled) {
          const next = payload?.data?.allowedRoutes;
          if (Array.isArray(next)) {
            // Keep /resources in sync with server merge (tenant policy + education routes).
            setAllowedRoutes([...new Set([...next, "/resources"])].sort());
          }
          const dl = payload?.data?.defaultLanding;
          setDefaultLanding(
            typeof dl === "string" && dl.trim().startsWith("/")
              ? normalizePathnameForPolicy(dl.trim())
              : "/xchat"
          );
        }
      } catch {
        // Best-effort nav hint only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { allowedRoutes, defaultLanding };
}
