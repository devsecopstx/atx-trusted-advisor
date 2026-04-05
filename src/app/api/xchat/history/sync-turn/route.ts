import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  void request;
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  return NextResponse.json(
    {
      error: "xChat turn sync to xAI collections is disabled for MVP privacy mode"
    },
    { status: 410 }
  );
}
