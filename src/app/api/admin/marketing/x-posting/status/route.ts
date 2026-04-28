import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getXchatPlatformSettings } from "@/modules/xchat/xchat-platform-settings";

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const doc = await getXchatPlatformSettings();
  const linked = Boolean(doc?.marketingXPostingRefreshTokenSealed?.trim());
  const username = doc?.marketingXPostingLinkedUsername?.trim();
  const updatedAt = doc?.marketingXPostingUpdatedAt?.toISOString();

  return NextResponse.json({
    data: {
      linked,
      username: username ?? null,
      updatedAt: updatedAt ?? null
    }
  });
}
