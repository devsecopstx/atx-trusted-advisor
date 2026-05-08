"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { escapeCsvField } from "@/lib/csv-field-escape";

export type PortfolioAlertAccountOption = {
  readonly id: string;
  readonly label: string;
};

type AlertRow = {
  _id: string;
  title: string;
  body: string | null;
  severity: string;
  status: string;
  symbol: string | null;
  portfolioId: string;
  portfolioName?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PortfolioAlertsToolbarProps = {
  portfolioId: string;
  alertCount: number;
};

export function PortfolioAlertsToolbar({ portfolioId, alertCount }: PortfolioAlertsToolbarProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"idle" | "clear" | "csv">("idle");
  const [error, setError] = useState<string | null>(null);

  const base = `/api/portfolios/${encodeURIComponent(portfolioId)}/alerts`;

  const downloadCsv = useCallback(async () => {
    setError(null);
    setBusy("csv");
    try {
      const res = await fetch(base, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setError(`Export failed (${res.status})`);
        return;
      }
      const payload = (await res.json()) as { data: AlertRow[] };
      const rows = payload.data ?? [];
      const headers = [
        "id",
        "portfolio_name",
        "account_name",
        "account_id",
        "title",
        "symbol",
        "severity",
        "status",
        "body",
        "created_at",
        "updated_at"
      ];
      const lines = [
        headers.join(","),
        ...rows.map((r) =>
          [
            escapeCsvField(r._id),
            escapeCsvField(r.portfolioName ?? ""),
            escapeCsvField(r.accountName ?? ""),
            escapeCsvField(r.accountId ?? ""),
            escapeCsvField(r.title),
            escapeCsvField(r.symbol ?? ""),
            escapeCsvField(r.severity),
            escapeCsvField(r.status),
            escapeCsvField(r.body ?? ""),
            escapeCsvField(r.createdAt),
            escapeCsvField(r.updatedAt)
          ].join(",")
        )
      ];
      const blob = new Blob(["\ufeff", lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-alerts-${portfolioId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed");
    } finally {
      setBusy("idle");
    }
  }, [base, portfolioId]);

  const clearAll = useCallback(async () => {
    if (alertCount <= 0) {
      return;
    }
    const ok = window.confirm(
      `Delete all ${alertCount} alert${alertCount === 1 ? "" : "s"} for this portfolio? This cannot be undone.`
    );
    if (!ok) {
      return;
    }
    setError(null);
    setBusy("clear");
    try {
      const res = await fetch(base, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? `Clear failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Clear failed");
    } finally {
      setBusy("idle");
    }
  }, [alertCount, base, router]);

  return (
    <div className="portfolio-alerts-toolbar">
      <p className="portfolio-alerts-toolbar__hint">
        Desk CSV reflects <strong>scanner rows only</strong>. NL price rules export is planned — rules live in{" "}
        <strong>portfolio_price_alerts</strong>.
      </p>
      <div className="portfolio-alerts-toolbar__actions">
        <button
          type="button"
          className="portfolio-alerts-toolbar__btn"
          disabled={alertCount === 0 || busy !== "idle"}
          onClick={() => void downloadCsv()}
        >
          {busy === "csv" ? "Exporting…" : "Download CSV"}
        </button>
        <button
          type="button"
          className="portfolio-alerts-toolbar__btn portfolio-alerts-toolbar__btn--danger"
          disabled={alertCount === 0 || busy !== "idle"}
          onClick={() => void clearAll()}
        >
          {busy === "clear" ? "Clearing…" : "Clear all alerts"}
        </button>
      </div>
      {error ? <p className="portfolio-alerts-toolbar__error status-text status-error">{error}</p> : null}
    </div>
  );
}
