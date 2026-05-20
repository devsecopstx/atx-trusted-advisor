import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import {
    getXchatPlatformSettings,
    parseMarketingPostingOAuthScopesList
} from "@/modules/xchat/xchat-platform-settings";

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const doc = await getXchatPlatformSettings();
  const linked = Boolean(doc?.marketingXPostingRefreshTokenSealed?.trim());
  const username = doc?.marketingXPostingLinkedUsername?.trim();
  const xUserId = doc?.marketingXUserId?.trim() || null;
  const adsAccountId = doc?.marketingXAdsAccountId?.trim() || null;
  const updatedAt = doc?.marketingXPostingUpdatedAt?.toISOString();
  const grantedScopes = parseMarketingPostingOAuthScopesList(doc?.marketingXPostingOAuthScopes);
  const tweetWriteGranted = grantedScopes.includes("tweet.write");

  return NextResponse.json({
    data: {
      linked,
      username: username ?? null,
      xUserId,
      adsAccountId,
      updatedAt: updatedAt ?? null,
      grantedScopes,
      /** False when scopes are stored and omit tweet.write; null when scopes unknown (legacy row). */
      postingLikelyBlocked:
        linked && doc?.marketingXPostingOAuthScopes !== undefined
          ? !tweetWriteGranted
          : null
    }
  });
}
