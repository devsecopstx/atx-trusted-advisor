import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { clearMarketingPostingOAuthRuntimeCaches } from "@/modules/marketing/x-posting-token-manager";
import { clearMarketingXPostingOAuth } from "@/modules/xchat/xchat-platform-settings";

export async function POST() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  await clearMarketingXPostingOAuth(session.userId);
  clearMarketingPostingOAuthRuntimeCaches();

  return NextResponse.json({ data: { disconnected: true } });
}
