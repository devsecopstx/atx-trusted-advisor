import {
    formatPositionUsd,
    normalizePositionType,
    type Position
} from "@/modules/core-admin/types";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";

export function serializePositionsForUi(rows: Position[]): SerializablePosition[] {
  return rows.filter((p) => p._id).map((p) => {
    const t = normalizePositionType(p.type);
    const id = p._id!.toHexString();
    if (t === "stock") {
      return {
        _id: id,
        type: "stock" as const,
        symbol: p.symbol,
        shares: p.qty,
        purchasePrice: p.avgCost
      };
    }
    if (t === "cash") {
      return {
        _id: id,
        type: "cash" as const,
        label: p.symbol,
        amount: p.avgCost,
        amountFormatted: formatPositionUsd(p.avgCost)
      };
    }
    const exp = p.expiration;
    return {
      _id: id,
      type: "option" as const,
      symbol: p.symbol,
      yahooRef: p.yahooRef ?? "",
      optionType: (p.optionType === "put" ? "put" : "call") as "call" | "put",
      strike: p.strike ?? 0,
      expiration: exp ? exp.toISOString().slice(0, 10) : "",
      contracts: p.qty,
      premiumPerContract: p.avgCost
    };
  });
}
