import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getFindOptionsBootstrap } from "@/modules/find-options/find-options-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const holdingsRaw = searchParams.get("holdingsLimit");
  const hotRaw = searchParams.get("hotLimit");
  const holdingsLimit = holdingsRaw ? parseInt(holdingsRaw, 10) : 12;
  const hotLimit = hotRaw ? parseInt(hotRaw, 10) : 3;
  const h = Number.isFinite(holdingsLimit) ? holdingsLimit : 12;
  const t = Number.isFinite(hotLimit) ? hotLimit : 3;

  const payload = await getFindOptionsBootstrap(session, { holdingsLimit: h, hotLimit: t });
  return NextResponse.json({ data: payload });
}
