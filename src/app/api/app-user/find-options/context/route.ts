import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getFindOptionsContext } from "@/modules/find-options/find-options-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const data = await getFindOptionsContext(session);
  return NextResponse.json({ data });
}
