import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { isUsefulXchatAsk } from "@/lib/onboarding/first-session-progress";

const CASH_SYMBOLS = ["CASH", "USD", "CASH-USD"];

export async function loadFirstSessionSignals(input: {
  userId: string;
}): Promise<{ hasHoldings: boolean; hasWatchlist: boolean; hasUsefulAsk: boolean }> {
  const db = await getDb();
  const userId = input.userId;

  const [holding, watchlist, recentAsks] = await Promise.all([
    db.collection("portfolio_positions").findOne(
      {
        userId,
        symbol: { $nin: CASH_SYMBOLS },
        type: { $ne: "cash" },
        qty: { $gt: 0 }
      },
      { projection: { _id: 1 } }
    ),
    db.collection("portfolio_watchlists").findOne(
      {
        userId,
        "symbols.0": { $exists: true }
      },
      { projection: { _id: 1 } }
    ),
    db
      .collection("xchat_logs")
      .find(
        {
          userId: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
          message: { $type: "string" }
        },
        { projection: { message: 1 } }
      )
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray()
  ]);

  return {
    hasHoldings: holding != null,
    hasWatchlist: watchlist != null,
    hasUsefulAsk: recentAsks.some((row) =>
      isUsefulXchatAsk(typeof row.message === "string" ? row.message : null)
    )
  };
}
