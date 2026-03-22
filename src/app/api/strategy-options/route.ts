import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getStrategyOptionsChain } from "@/modules/strategy-options/options-chain";

export const dynamic = "force-dynamic";

/**
 * Option chain for xStrategyBuilder — aligned with xfinance-strategy `GET /api/options`.
 * Query: `underlying`, `expiration` (YYYY-MM-DD or Yahoo unix seconds), optional `strike` (anchor for synthetic fallback).
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  return getStrategyOptionsChain(request.url);
}
