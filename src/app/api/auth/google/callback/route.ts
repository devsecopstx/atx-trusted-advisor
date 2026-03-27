import { NextResponse } from "next/server";

import {
    clearOAuthFlowCookies,
    consumeOAuthReturnPathCookie,
    getSessionUser,
    isSafeOAuthReturnPath,
    readOAuthFlowCookies
} from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    getAtxfinanceBackendOrigin,
    getEnv,
    getGoogleClientId,
    isAllowAnyXUserLoginEnabled,
    isGoogleOAuthConfigured
} from "@/lib/env";
import { extractClientLoginMeta } from "@/lib/client-request-meta";
import { getEffectiveHostname, getPublicOriginFromRequest } from "@/lib/http-origin";
import { finalizeOAuthSessionAndRedirect } from "@/lib/oauth-complete-session";
import { isSeedAdminEmail } from "@/lib/seed-admin-email";
import {
    createAccessRequest,
    getPendingAccessRequestByUserAndRole
} from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import {
    ensureCoreUserByEmail,
    ensureSeededGlobalAdmin,
    getCoreUserByEmail,
    getCoreUserByXIdentity,
    linkXAccountToUser,
    unlinkXAccountFromUser
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

type GoogleTokenResponse = {
  access_token: string;
  token_type: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function googleUsernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const safe = local.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 48);
  return safe || "google_user";
}

function googleLinkedId(sub: string): string {
  return `google:${sub}`;
}

async function ensurePendingViewerAccessRequestAfterGoogleOAuth(user: CoreUser): Promise<void> {
  const oid = user._id;
  if (!oid) {
    return;
  }
  const userId = oid.toHexString();
  const requestedRole = "viewer" as const;
  const existingPending = await getPendingAccessRequestByUserAndRole({
    userId,
    requestedRole
  });
  if (existingPending) {
    return;
  }
  await createAccessRequest({
    userId,
    requestedRole,
    contactEmail: user.email,
    reason: "Auto-created from unapproved Google login attempt"
  });
}

function isSameUserId(
  left: { toHexString: () => string },
  right: { toHexString: () => string }
): boolean {
  return left.toHexString() === right.toHexString();
}

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 503 });
  }

  if (
    getAtxfinanceBackendOrigin() &&
    process.env.AUTH_CALLBACK_USE_SPRING === "true"
  ) {
    const proxied = await proxyRequestToBackend(request);
    if (proxied) {
      const headers = new Headers(proxied.headers);
      return new Response(proxied.body, { status: proxied.status, headers });
    }
  }

  const env = getEnv();
  const url = new URL(request.url);
  const effectiveHost = getEffectiveHostname(request);
  if (env.NODE_ENV !== "production" && effectiveHost === "localhost") {
    const devHostUrl = new URL(url.pathname + url.search, url.toString());
    devHostUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(devHostUrl.toString());
  }

  const configuredCallbackUrl = env.GOOGLE_OAUTH_CALLBACK_URL?.trim();
  if (env.NODE_ENV === "production" && configuredCallbackUrl) {
    try {
      const callbackHost = new URL(configuredCallbackUrl).host.toLowerCase();
      const currentHost = getPublicOriginFromRequest(request)
        .replace(/^https?:\/\//, "")
        .toLowerCase();
      if (callbackHost !== currentHost) {
        const canonical = new URL(url.pathname + url.search, configuredCallbackUrl);
        return NextResponse.redirect(canonical.toString());
      }
    } catch {
      // fall through
    }
  }

  const origin = getPublicOriginFromRequest(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const callbackUrl =
    env.NODE_ENV === "production"
      ? (env.GOOGLE_OAUTH_CALLBACK_URL ?? `${origin}/api/auth/google/callback`)
      : `${origin}/api/auth/google/callback`;

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/xchat?error=missing_oauth_callback_params", origin)
    );
  }

  const flowCookies = await readOAuthFlowCookies();
  if (!flowCookies.state || !flowCookies.verifier) {
    const existingSession = await getSessionUser();
    if (existingSession) {
      const returnPath = await consumeOAuthReturnPathCookie();
      const fallback = isGlobalAdmin(existingSession.roles) ? "/admin" : "/xchat";
      const target =
        returnPath && isSafeOAuthReturnPath(returnPath) ? returnPath : fallback;
      return NextResponse.redirect(new URL(target, origin));
    }
    return NextResponse.redirect(
      new URL("/xchat?error=missing_oauth_cookie_context", origin)
    );
  }
  if (state !== flowCookies.state) {
    await clearOAuthFlowCookies();
    return NextResponse.redirect(new URL("/xchat?error=invalid_oauth_state", origin));
  }
  await clearOAuthFlowCookies();

  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    return NextResponse.redirect(new URL("/xchat?error=google_oauth_not_configured", origin));
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: getGoogleClientId(),
      client_secret: clientSecret,
      code_verifier: flowCookies.verifier
    }).toString()
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/xchat?error=token_exchange_failed", origin));
  }

  const tokenJson = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenJson.access_token) {
    return NextResponse.redirect(new URL("/xchat?error=missing_access_token", origin));
  }

  const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  if (!userInfoRes.ok) {
    return NextResponse.redirect(new URL("/xchat?error=userinfo_failed", origin));
  }

  const profile = (await userInfoRes.json()) as GoogleUserInfo;
  if (!profile.sub) {
    return NextResponse.redirect(new URL("/xchat?error=invalid_user_profile", origin));
  }
  if (!profile.email || !profile.email_verified) {
    return NextResponse.redirect(new URL("/xchat?error=google_email_required", origin));
  }

  const emailNormalized = profile.email.trim().toLowerCase();
  const linkedId = googleLinkedId(profile.sub);
  const username = googleUsernameFromEmail(emailNormalized);
  const identity = {
    xUserId: linkedId,
    username,
    displayName: profile.name,
    avatarUrl: profile.picture
  };

  const seededAdmin =
    isSeedAdminEmail(emailNormalized, env.ADMIN_SEED_EMAIL)
      ? await ensureSeededGlobalAdmin(emailNormalized)
      : null;

  let user = await getCoreUserByXIdentity(linkedId);

  if (user?._id && emailNormalized) {
    const userByEmail = seededAdmin?.user ?? (await getCoreUserByEmail(emailNormalized));
    const approvedEmailUserId = userByEmail?._id;
    if (approvedEmailUserId !== undefined) {
      const shouldRelinkToApprovedEmailUser =
        !isSameUserId(user._id, approvedEmailUserId) &&
        canUserLogin(userByEmail?.roles ?? []);

      if (shouldRelinkToApprovedEmailUser) {
        await unlinkXAccountFromUser({ userId: user._id });
        user = await linkXAccountToUser({
          userId: approvedEmailUserId,
          ...identity
        });
      }
    }
  }

  if (!user) {
    user = seededAdmin?.user ?? (await getCoreUserByEmail(emailNormalized));
    if (!user?._id) {
      user = await ensureCoreUserByEmail({
        email: emailNormalized
      });
    }
    if (!user?._id) {
      return NextResponse.redirect(new URL("/xchat?error=not_seeded_email", origin));
    }
    user = await linkXAccountToUser({
      userId: user._id,
      ...identity
    });
  } else if (user._id) {
    user = await linkXAccountToUser({
      userId: user._id,
      ...identity
    });
  }

  if (!user?._id) {
    return NextResponse.redirect(new URL("/xchat?error=access_request_pending", origin));
  }

  const allowAnyLogin = isAllowAnyXUserLoginEnabled();
  const hasLoginRole = canUserLogin(user.roles);
  const shouldAllowFallbackLogin = Boolean(user._id) && !hasLoginRole && allowAnyLogin;

  if (!hasLoginRole && !shouldAllowFallbackLogin) {
    await ensurePendingViewerAccessRequestAfterGoogleOAuth(user);
    return NextResponse.redirect(new URL("/xchat?error=access_request_pending", origin));
  }

  return finalizeOAuthSessionAndRedirect({
    origin,
    user,
    identity,
    usernameForAdminAllowlist: username,
    loginMeta: extractClientLoginMeta(request)
  });
}
