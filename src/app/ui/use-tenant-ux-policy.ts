"use client";

import { useEffect, useState } from "react";

type TenantUxPolicyPayload = {
  data: {
    allowedRoutes: string[];
    defaultLanding: string;
  };
};

export function useTenantUxPolicy() {
  const [allowedRoutes, setAllowedRoutes] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/app-user/me/role", { cache: "no-store" });
        if (!res.ok) {
          return;
        }
        const payload = (await res.json()) as TenantUxPolicyPayload;
        if (!cancelled) {
          const next = payload?.data?.allowedRoutes;
          if (Array.isArray(next)) {
            setAllowedRoutes(next);
          }
        }
      } catch {
        // Best-effort nav hint only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { allowedRoutes };
}
