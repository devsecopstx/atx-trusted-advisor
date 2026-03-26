import type { Account, Position } from "@/modules/core-admin/types";
import { formatPositionUsd, normalizePositionType } from "@/modules/core-admin/types";

export type PortfolioHoldingRow = {
  accountIdHex: string;
  accountName: string;
  positionType: ReturnType<typeof normalizePositionType>;
  symbol: string;
  detail: string;
  bookUsd: number;
};

function bookUsdForPosition(p: Position): number {
  const t = normalizePositionType(p.type);
  if (t === "option") {
    return p.qty * 100 * p.avgCost;
  }
  return p.qty * p.avgCost;
}

function detailForPosition(p: Position): string {
  const t = normalizePositionType(p.type);
  if (t === "stock") {
    return `${p.qty} sh @ ${formatPositionUsd(p.avgCost)}`;
  }
  if (t === "cash") {
    return `${p.symbol}: ${formatPositionUsd(p.avgCost)}`;
  }
  const exp = p.expiration ? p.expiration.toISOString().slice(0, 10) : "—";
  return `${p.symbol} ${(p.optionType ?? "call").toUpperCase()} ${p.strike ?? "—"} ${exp} · ${p.yahooRef ?? "—"} · ${p.qty}× @ ${p.avgCost.toFixed(2)}/ct`;
}

/** Flatten positions with account names for the “My holdings” tab and CSV export. */
export function buildPortfolioHoldingRows(accounts: Account[], positions: Position[]): PortfolioHoldingRow[] {
  const nameByHex = new Map<string, string>();
  for (const a of accounts) {
    if (a._id) {
      nameByHex.set(a._id.toHexString(), a.name ?? "Account");
    }
  }
  return positions.map((p) => {
    const hex = p.accountId.toHexString();
    return {
      accountIdHex: hex,
      accountName: nameByHex.get(hex) ?? "Account",
      positionType: normalizePositionType(p.type),
      symbol: p.symbol,
      detail: detailForPosition(p),
      bookUsd: bookUsdForPosition(p)
    };
  });
}
