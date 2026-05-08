import { accountRefLastFourOnlyDisplay } from "@/lib/account-xref-display";

import type { BrokerHoldingsPosition, ParsedBrokerAccount } from "./broker-holdings-import";

export type BrokerImportPreviewSampleRow = {
  accountLabel: string;
  accountRefLast4: string;
  symbol: string;
  qty: string;
  avgCost: string;
  last: string;
  value: string;
  rowType: "stock" | "option" | "cash";
};

export type BrokerImportCsvStats = {
  /** Non-empty lines in the uploaded file (includes header). */
  nonEmptyLines: number;
  /** Sum of position rows across parsed broker accounts. */
  totalPositionsParsed: number;
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : n;
  return String(rounded);
}

function stockOptionAvgCostDisplay(p: BrokerHoldingsPosition): string {
  if (p.type === "stock") {
    const px = p.purchasePrice;
    return px != null && Number.isFinite(px) ? formatUsd(px) : "—";
  }
  if (p.type === "option") {
    const prem = p.premium;
    return prem != null && Number.isFinite(prem) ? formatUsd(prem) : "—";
  }
  const px = p.purchasePrice;
  return px != null && Number.isFinite(px) ? formatUsd(px) : "—";
}

function positionLastDisplay(p: BrokerHoldingsPosition): string {
  const lp = "lastPriceUsd" in p ? p.lastPriceUsd : undefined;
  return lp != null && Number.isFinite(lp) ? formatUsd(lp) : "—";
}

function positionValueDisplay(p: BrokerHoldingsPosition): string {
  const cv = p.currentValueUsd;
  if (cv != null && Number.isFinite(cv)) {
    return formatUsd(cv);
  }
  if (p.type === "stock") {
    const sh = Number(p.shares ?? 0);
    const px = p.purchasePrice != null && Number.isFinite(p.purchasePrice) ? p.purchasePrice : 0;
    if (Number.isFinite(sh) && sh !== 0 && px >= 0) {
      return formatUsd(sh * px);
    }
  }
  if (p.type === "option") {
    const c = Math.abs(Number(p.contracts ?? 0));
    const prem = p.premium != null && Number.isFinite(p.premium) ? p.premium : 0;
    if (c > 0 && prem >= 0) {
      return formatUsd(c * prem * 100);
    }
  }
  if (p.type === "cash") {
    const price = p.purchasePrice != null && Number.isFinite(p.purchasePrice) ? Math.max(0, p.purchasePrice) : 0;
    const sh = p.shares != null && Number.isFinite(p.shares) ? Math.abs(p.shares) : 1;
    return formatUsd(price * (sh || 1));
  }
  return "—";
}

function rowTypeLabel(p: BrokerHoldingsPosition): "stock" | "option" | "cash" {
  return p.type;
}

function positionQtyDisplay(p: BrokerHoldingsPosition): string {
  if (p.type === "stock") {
    return formatQty(Number(p.shares ?? 0));
  }
  if (p.type === "option") {
    const c = Number(p.contracts ?? 0);
    return `${formatQty(c)} contracts`;
  }
  const sh = Number(p.shares ?? 0);
  return formatQty(sh || 1);
}

export function countCsvNonEmptyLines(csv: string): number {
  const normalized = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.split("\n").reduce((acc, line) => acc + (line.trim() ? 1 : 0), 0);
}

export function brokerImportCsvStatsFromParsed(csv: string, accounts: ParsedBrokerAccount[]): BrokerImportCsvStats {
  let totalPositionsParsed = 0;
  for (const a of accounts) {
    totalPositionsParsed += a.positions.length;
  }
  return {
    nonEmptyLines: countCsvNonEmptyLines(csv),
    totalPositionsParsed
  };
}

export function collectBrokerImportPreviewWarnings(accounts: ParsedBrokerAccount[]): string[] {
  const warnings: string[] = [];
  let negativeStock = false;
  let negativeOptionContracts = false;
  for (const acc of accounts) {
    for (const p of acc.positions) {
      if (p.type === "stock" && Number(p.shares ?? 0) < 0) {
        negativeStock = true;
      }
      if (p.type === "option" && Number(p.contracts ?? 0) < 0) {
        negativeOptionContracts = true;
      }
    }
  }
  if (negativeStock) {
    warnings.push("Negative share quantities appear in this file — verify the broker export before applying.");
  }
  if (negativeOptionContracts) {
    warnings.push(
      "Short option contracts appear in this file; net-short legs are skipped until short modeling is enabled."
    );
  }
  return warnings;
}

/**
 * Flatten parsed holdings into a capped list for dry-run UI (virtualized sample table).
 */
export function buildBrokerImportPreviewSampleRows(
  accounts: ParsedBrokerAccount[],
  maxRows: number
): BrokerImportPreviewSampleRow[] {
  const rows: BrokerImportPreviewSampleRow[] = [];
  if (maxRows <= 0) {
    return rows;
  }
  for (const acc of accounts) {
    const ref4 = accountRefLastFourOnlyDisplay(acc.accountRef);
    const label = (acc.label || ref4 || "Account").trim();
    for (const p of acc.positions) {
      if (rows.length >= maxRows) {
        return rows;
      }
      const sym =
        p.type === "option"
          ? `${p.ticker} ${p.optionType ?? ""} ${p.strike ?? ""} ${p.expiration ?? ""}`.trim()
          : (p.ticker || "").trim() || "—";
      rows.push({
        accountLabel: label,
        accountRefLast4: ref4,
        symbol: sym.toUpperCase(),
        qty: positionQtyDisplay(p),
        avgCost: stockOptionAvgCostDisplay(p),
        last: positionLastDisplay(p),
        value: positionValueDisplay(p),
        rowType: rowTypeLabel(p)
      });
    }
  }
  return rows;
}
