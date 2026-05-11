"use client";

import { useCallback, useState } from "react";

import type { AccountOutlook } from "@/modules/core-admin/types";

export type InvestmentOutlookRefreshOk = {
  ok: true;
  marketOutlook: AccountOutlook | null;
  confidence: number | null;
  lastRefreshedIso: string | null;
  source: string | null;
};

export type InvestmentOutlookRefreshErr = {
  ok: false;
  error: string;
  code?: string;
};

export type InvestmentOutlookRefreshResult = InvestmentOutlookRefreshOk | InvestmentOutlookRefreshErr;

type WireAccount = {
  outlook?: AccountOutlook | null;
  outlookConfidence?: number | null;
  lastOutlookRefreshAt?: string | Date | null;
  outlookRefreshSource?: string | null;
};

/**
 * POST `/api/accounts/{accountId}/outlook/refresh` — resolves owning portfolio server-side.
 */
export function useInvestmentOutlookRefresh(accountId: string) {
  const [pending, setPending] = useState(false);

  const refreshOutlook = useCallback(async (): Promise<InvestmentOutlookRefreshResult> => {
    setPending(true);
    try {
      const res = await fetch(
        `/api/accounts/${encodeURIComponent(accountId)}/outlook/refresh`,
        { method: "POST", credentials: "include" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: WireAccount;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          error: typeof body.error === "string" ? body.error : "Outlook refresh failed",
          code: typeof body.code === "string" ? body.code : undefined
        };
      }
      const row = body.data;
      const lastRaw = row?.lastOutlookRefreshAt;
      const lastIso =
        lastRaw instanceof Date
          ? lastRaw.toISOString()
          : typeof lastRaw === "string"
            ? lastRaw
            : null;
      return {
        ok: true,
        marketOutlook: row?.outlook ?? null,
        confidence:
          typeof row?.outlookConfidence === "number" && Number.isFinite(row.outlookConfidence)
            ? row.outlookConfidence
            : null,
        lastRefreshedIso: lastIso,
        source: typeof row?.outlookRefreshSource === "string" ? row.outlookRefreshSource : null
      };
    } catch {
      return { ok: false, error: "Network error during outlook refresh" };
    } finally {
      setPending(false);
    }
  }, [accountId]);

  return { refreshOutlook, refreshPending: pending };
}
