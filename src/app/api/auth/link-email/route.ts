import { NextResponse } from "next/server";
import { z } from "zod";

import { consumePendingXLinkCookie, createSession } from "@/lib/auth";
import { isAllowAnyXUserLoginEnabled } from "@/lib/env";
import {
  createAccessRequest,
  getPendingAccessRequestByUserAndRole,
  provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import {
  ensureDefaultTenant,
  ensureCoreUserByEmail,
  getCoreUserByEmail,
  getCoreUserByXIdentity,
  linkXAccountToUser,
  resolveAuthContext,
  updateCoreUserEmail,
  upsertTenantMembership
} from "@/modules/identity/repository";

const linkSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const pending = await consumePendingXLinkCookie();
  if (!pending) {
    return NextResponse.json({ error: "No pending X login context found" }, { status: 400 });
  }

  let user = await getCoreUserByEmail(parsed.data.email);
  const existingByXIdentity = await getCoreUserByXIdentity(pending.xUserId);
  if (existingByXIdentity?._id && isPlaceholderEmail(existingByXIdentity.email)) {
    user = await updateCoreUserEmail({
      userId: existingByXIdentity._id,
      email: parsed.data.email
    });
  }
  if (!user?._id) {
    user = await ensureCoreUserByEmail({
      email: parsed.data.email
    });
  }
  if (!user?._id) {
    return NextResponse.json(
      { error: "Unable to create or resolve user by email" },
      { status: 500 }
    );
  }

  const linkedUser = await linkXAccountToUser({
    userId: user._id,
    xUserId: pending.xUserId,
    username: pending.username,
    displayName: pending.displayName,
    avatarUrl: pending.avatarUrl
  });

  const allowAnyXUserLogin = isAllowAnyXUserLoginEnabled();
  const hasLoginRole = canUserLogin(linkedUser.roles);

  if (!hasLoginRole) {
    const userId = linkedUser._id?.toHexString();
    if (userId) {
      const requestedRole = "viewer";
      const existingPending = await getPendingAccessRequestByUserAndRole({
        userId,
        requestedRole
      });
      if (!existingPending) {
        await createAccessRequest({
          userId,
          requestedRole,
          reason: "Auto-created from email-link login attempt"
        });
      }
    }

    if (!allowAnyXUserLogin) {
      return NextResponse.json({
        ok: true,
        redirectTo: "/login?error=access_request_pending"
      });
    }
  }

  const tenant = await ensureDefaultTenant();
  if (!tenant._id || !linkedUser._id) {
    return NextResponse.json({ error: "Failed to resolve tenant context" }, { status: 500 });
  }
  await upsertTenantMembership({
    userId: linkedUser._id,
    tenantId: tenant._id,
    role: "tenant_admin",
    isDefaultTenant: true
  });

  const authContext = await resolveAuthContext({ user: linkedUser });
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
    xUserId: authContext.xUserId ?? pending.xUserId,
    username: authContext.username ?? pending.username,
    displayName: authContext.displayName ?? pending.displayName,
    avatarUrl: authContext.avatarUrl ?? pending.avatarUrl
  });

  return NextResponse.json({
    ok: true,
    redirectTo: isGlobalAdmin(sessionRoles) ? "/admin" : "/xchat"
  });
}

function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@x.identity.local");
}
