import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getSymbolSnapshot } from "@/modules/find-options/find-options-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim() ?? "";
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const data = await getSymbolSnapshot(session, symbol);
  if (!data) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  return NextResponse.json({ data });
}
