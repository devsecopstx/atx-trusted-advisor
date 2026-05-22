import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getAdvisorDisclosurePayload } from "@/modules/compliance/advisor-compliance-gate";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ data: getAdvisorDisclosurePayload() });
}
