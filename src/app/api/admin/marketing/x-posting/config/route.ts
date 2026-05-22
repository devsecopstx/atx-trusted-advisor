import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { setMarketingXPostingTargetIds } from "@/modules/xchat/xchat-platform-settings";

/**
 * PATCH body allows independent update of the X numeric user id and/or Ads account id.
 * These survive OAuth disconnect and are used for ad campaign creation targeting.
 */
export async function PATCH(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const xUserId = typeof payload.xUserId === "string" ? payload.xUserId : undefined;
  const adsAccountId = typeof payload.adsAccountId === "string" ? payload.adsAccountId : undefined;

  if (xUserId === undefined && adsAccountId === undefined) {
    return NextResponse.json({ error: "Provide xUserId and/or adsAccountId" }, { status: 400 });
  }

  try {
    const updated = await setMarketingXPostingTargetIds({
      xUserId: xUserId ?? null,
      adsAccountId: adsAccountId ?? null,
      actorUserId: session.userId
    });

    return NextResponse.json({
      data: {
        xUserId: updated.marketingXUserId ?? null,
        adsAccountId: updated.marketingXAdsAccountId ?? null,
        updatedAt: updated.updatedAt?.toISOString() ?? null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save X targeting ids";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}