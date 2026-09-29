import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { deriveFirstSessionProgress } from "@/lib/onboarding/first-session-progress";
import { loadFirstSessionSignals } from "@/lib/onboarding/first-session-progress-load";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const signals = await loadFirstSessionSignals({ userId: session.userId });
  const progress = deriveFirstSessionProgress(signals);

  return NextResponse.json(
    { data: progress },
    { headers: { "Cache-Control": "private, max-age=20" } }
  );
}
