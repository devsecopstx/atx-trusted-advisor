import { NextResponse } from "next/server";

import { getEffectiveHostname, getPublicOriginFromRequest } from "@/lib/http-origin";
import {
    clearOAuthFlowCookies,
    createSession,
    getSessionUser,
    readOAuthFlowCookies,
    setPendingXLinkCookie
} from "@/lib/auth";
import {
    getEnv,
    getXOauthClientId,
    isAllowAnyXUserLoginEnabled
} from "@/lib/env";
import { getEffectiveHostname, getPublicOriginFromRequest } from "@/lib/http-origin";
import { isSeedAdminEmail } from "@/lib/seed-admin-email";
import {
    createAccessRequest,
    getPendingAccessRequestByUserAndRole,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import {
    ensureCoreUserByEmail,
    ensureDefaultTenant,
    ensureSeededGlobalAdmin,
    getCoreUserByEmail,
    getCoreUserByXIdentity,
    linkXAccountToUser,
    resolveAuthContext,
    unlinkXAccountFromUser,
    upsertTenantMembership
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

type XTokenResponse = {
  access_token: string;
  token_type: string;
};

type XUserResponse = {
  data?: {
    id: string;
    username: string;
    name?: string;
    profile_image_url?: string;
    email?: string;
  };
};

async function ensurePendingViewerAccessRequestAfterOAuth(user: CoreUser): Promise<void> {
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
    reason: isPlaceholderEmail(user.email)
      ? "Auto-created: X login without email on profile — user on link-email step (email_link_required)"
      : "Auto-created from unapproved X login attempt"
  });
}

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const effectiveHost = getEffectiveHostname(request);
  if (env.NODE_ENV !== "production" && effectiveHost === "localhost") {
    const devHostUrl = new URL(url.pathname + url.search, url.toString());
    devHostUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(devHostUrl.toString());
  }
  const origin = getPublicOriginFromRequest(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const tokenUrl = env.X_OAUTH_TOKEN_URL ?? "https://api.x.com/2/oauth2/token";
  const callbackUrl =
    env.NODE_ENV === "production"
      ? (env.X_OAUTH_CALLBACK_URL ?? `${origin}/api/auth/x/callback`)
      : `${origin}/api/auth/x/callback`;

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=missing_oauth_callback_params", origin)
    );
  }

  const flowCookies = await readOAuthFlowCookies();
  if (!flowCookies.state || !flowCookies.verifier) {
    const existingSession = await getSessionUser();
    if (existingSession) {
      return NextResponse.redirect(
        new URL(isGlobalAdmin(existingSession.roles) ? "/admin" : "/xchat", origin)
      );
    }
    return NextResponse.redirect(
      new URL("/login?error=missing_oauth_cookie_context", origin)
    );
  }
  if (state !== flowCookies.state) {
    await clearOAuthFlowCookies();
    return NextResponse.redirect(new URL("/login?error=invalid_oauth_state", origin));
  }
  await clearOAuthFlowCookies();

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${getXOauthClientId()}:${env.X_OAUTH_CLIENT_SECRET}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      code_verifier: flowCookies.verifier
    }).toString()
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/login?error=token_exchange_failed", origin));
  }

  const tokenJson = (await tokenResponse.json()) as XTokenResponse;
  if (!tokenJson.access_token) {
    return NextResponse.redirect(new URL("/login?error=missing_access_token", origin));
  }

  const userInfoResult = await fetchXUserProfile(
    tokenJson.access_token,
    env.X_OAUTH_USERINFO_URL
  );
  if (!userInfoResult.ok) {
    const failureUrl = new URL("/login?error=userinfo_failed", origin);
    if (userInfoResult.details) {
      failureUrl.searchParams.set("details", userInfoResult.details);
    }
    return NextResponse.redirect(failureUrl);
  }
  const userInfoJson = userInfoResult.profile;
  if (!userInfoJson.data?.id || !userInfoJson.data?.username) {
    return NextResponse.redirect(new URL("/login?error=invalid_user_profile", origin));
  }

  const xIdentity = {
    xUserId: userInfoJson.data.id,
    username: userInfoJson.data.username,
    displayName: userInfoJson.data.name,
    avatarUrl: userInfoJson.data.profile_image_url
  };
  const emailFromProvider = userInfoJson.data.email?.trim().toLowerCase();
  const seededAdmin =
    emailFromProvider && isSeedAdminEmail(emailFromProvider, env.ADMIN_SEED_EMAIL)
      ? await ensureSeededGlobalAdmin(emailFromProvider)
      : null;

  let user = await getCoreUserByXIdentity(xIdentity.xUserId);
  if (user?._id && emailFromProvider) {
    const userByEmail = seededAdmin?.user ?? (await getCoreUserByEmail(emailFromProvider));
    const approvedEmailUserId = userByEmail?._id;
    if (approvedEmailUserId !== undefined) {
      const shouldRelinkToApprovedEmailUser =
        !isSameUserId(user._id, approvedEmailUserId) &&
        canUserLogin(userByEmail?.roles ?? []);

      if (shouldRelinkToApprovedEmailUser) {
        await unlinkXAccountFromUser({ userId: user._id });
        user = await linkXAccountToUser({
          userId: approvedEmailUserId,
          ...xIdentity
        });
      }
    }
  }
  if (!user) {
    if (!emailFromProvider) {
      const placeholderEmail = buildXIdentityPlaceholderEmail(xIdentity.xUserId);
      user = await ensureCoreUserByEmail({
        email: placeholderEmail
      });
      if (!user?._id) {
        await setPendingXLinkCookie(xIdentity);
        return NextResponse.redirect(new URL("/login?error=email_link_required", origin));
      }
      user = await linkXAccountToUser({
        userId: user._id,
        ...xIdentity
      });
    } else {
      user = seededAdmin?.user ?? (await getCoreUserByEmail(emailFromProvider));
      if (!user?._id) {
        user = await ensureCoreUserByEmail({
          email: emailFromProvider
        });
      }
      if (!user?._id) {
        return NextResponse.redirect(new URL("/login?error=not_seeded_email", origin));
      }
      user = await linkXAccountToUser({
        userId: user._id,
        ...xIdentity
      });
    }
  } else if (user._id) {
    user = await linkXAccountToUser({
      userId: user._id,
      ...xIdentity
    });
  }

  // Placeholder email only blocks OAuth completion until the user has a login-eligible *platform* role.
  // After an admin approves the access request (e.g. viewer), allow sign-in even without X email / real email.
  if (
    isPlaceholderEmail(user.email) &&
    user._id &&
    !canUserLogin(user.roles)
  ) {
    await ensurePendingViewerAccessRequestAfterOAuth(user);
    await setPendingXLinkCookie(xIdentity);
    return NextResponse.redirect(new URL("/login?error=email_link_required", origin));
  }

  const allowAnyXUserLogin = isAllowAnyXUserLoginEnabled();
  const hasLoginRole = user?._id ? canUserLogin(user.roles) : false;
  const shouldAllowFallbackLogin =
    Boolean(user?._id) && !hasLoginRole && allowAnyXUserLogin;

  if (!user?._id || !hasLoginRole) {
    if (user?._id) {
      await ensurePendingViewerAccessRequestAfterOAuth(user);
    }

    if (!shouldAllowFallbackLogin) {
      return NextResponse.redirect(new URL("/login?error=access_request_pending", origin));
    }
  }
  if (!user._id) {
    return NextResponse.redirect(new URL("/login?error=access_request_pending", origin));
  }

  const userObjectId = user._id;

  const allowlist = (env.ADMIN_X_USERNAMES ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (
    allowlist.length > 0 &&
    isGlobalAdmin(user.roles) &&
    !allowlist.includes(userInfoJson.data.username.toLowerCase())
  ) {
    return NextResponse.redirect(new URL("/login?error=not_authorized_admin", origin));
  }

  const tenant = await ensureDefaultTenant();
  if (!tenant._id) {
    return NextResponse.redirect(new URL("/login?error=tenant_bootstrap_failed", origin));
  }

  try {
    await upsertTenantMembership({
      userId: userObjectId,
      tenantId: tenant._id,
      role: "tenant_admin",
      isDefaultTenant: true
    });
    const authContext = await resolveAuthContext({ user });
    const sessionRoles = hasLoginRole
      ? authContext.roles
      : authContext.roles.length > 0
        ? authContext.roles
        : ["viewer"];

    await provisionDefaultPortfolioForUser({
      userId: authContext.userId.toHexString(),
      tenantId: authContext.tenantId.toHexString()
    });

    await createSession({
      userId: authContext.userId.toHexString(),
      email: authContext.email,
      roles: sessionRoles,
      tenantId: authContext.tenantId.toHexString(),
      tenantRole: authContext.tenantRole,
      xUserId: authContext.xUserId ?? xIdentity.xUserId,
      username: authContext.username ?? xIdentity.username,
      displayName: authContext.displayName ?? xIdentity.displayName,
      avatarUrl: authContext.avatarUrl ?? xIdentity.avatarUrl
    });

    return NextResponse.redirect(
      new URL(isGlobalAdmin(sessionRoles) ? "/admin" : "/xchat", origin)
    );
  } catch (error) {
    console.error("[auth/x/callback] session bootstrap failed", {
      userId: userObjectId.toHexString(),
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.redirect(new URL("/login?error=bootstrap_failed", origin));
  }
}

async function fetchXUserProfile(
  accessToken: string,
  customUrl?: string
): Promise<
  { ok: true; profile: XUserResponse } | { ok: false; details: string }
> {
  const candidateUrls = [
    customUrl,
    "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url,email",
    "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url",
    "https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url,email",
    "https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url"
  ].filter((value): value is string => Boolean(value));

  const attempted = new Set<string>();
  const attemptDetails: string[] = [];
  for (const userInfoUrl of candidateUrls) {
    if (attempted.has(userInfoUrl)) {
      continue;
    }
    attempted.add(userInfoUrl);

    try {
      const userInfoResponse = await fetch(userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!userInfoResponse.ok) {
        attemptDetails.push(`${extractHost(userInfoUrl)}:${userInfoResponse.status}`);
        continue;
      }

      const userInfoJson = (await userInfoResponse.json()) as XUserResponse;
      if (!userInfoJson.data?.id || !userInfoJson.data?.username) {
        attemptDetails.push(`${extractHost(userInfoUrl)}:invalid_profile`);
        continue;
      }

      return {
        ok: true,
        profile: userInfoJson
      };
    } catch {
      attemptDetails.push(`${extractHost(userInfoUrl)}:network_error`);
      continue;
    }
  }

  return {
    ok: false,
    details: attemptDetails.join(",")
  };
}

function extractHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid_url";
  }
}

function buildXIdentityPlaceholderEmail(xUserId: string): string {
  return `xid-${xUserId.toLowerCase()}@x.identity.local`;
}

function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@x.identity.local");
}

function isSameUserId(
  left: { toHexString: () => string },
  right: { toHexString: () => string }
): boolean {
  return left.toHexString() === right.toHexString();
}

