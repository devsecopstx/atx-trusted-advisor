import { createSession } from "@/lib/auth";
import type { ClientLoginMeta } from "@/lib/client-request-meta";
import { resolveOrCreateUserBootstrapCollection } from "@/modules/core-admin/access-request-bootstrap";
import { ensureTenantBootstrapForUser } from "@/modules/core-admin/tenant-user-bootstrap";
import { isCoreUserAccountAccessApproved } from "@/modules/identity/account-status";
import { canUserLogin, normalizeCoreRoles } from "@/modules/identity/authorization";
import {
    recordUserSuccessfulLogin,
    resolveAuthContext
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";
import { getXchatUserPreferences } from "@/modules/xchat/user-preferences-repository";

export class EmailPasswordSessionError extends Error {
  constructor(
    public readonly code:
      | "missing_user"
      | "not_authorized"
      | "suspended"
      | "no_tenant"
      | "account_not_approved"
  ) {
    super(code);
    this.name = "EmailPasswordSessionError";
  }
}

/**
 * Issues session cookie for a user who authenticated with email + password (or immediately after invite completion).
 */
export async function finalizeEmailPasswordSession(input: {
  user: CoreUser;
  loginMeta?: ClientLoginMeta;
}): Promise<void> {
  const { user, loginMeta } = input;
  if (!user._id) {
    throw new EmailPasswordSessionError("missing_user");
  }
  if (user.status === "suspended") {
    throw new EmailPasswordSessionError("suspended");
  }
  if (!isCoreUserAccountAccessApproved(user)) {
    throw new EmailPasswordSessionError("account_not_approved");
  }
  if (!canUserLogin(user.roles)) {
    throw new EmailPasswordSessionError("not_authorized");
  }

  let authContext;
  try {
    authContext = await resolveAuthContext({ user });
  } catch {
    throw new EmailPasswordSessionError("no_tenant");
  }

  try {
    await ensureTenantBootstrapForUser({
      userId: authContext.userId.toHexString(),
      tenantId: authContext.tenantId.toHexString(),
      trigger: "email_login"
    });
  } catch (provisionError) {
    console.warn("[auth/email] tenant bootstrap non-fatal", {
      userId: authContext.userId.toHexString(),
      message: provisionError instanceof Error ? provisionError.message : String(provisionError)
    });
  }

  try {
    const prefs = await getXchatUserPreferences({
      userId: authContext.userId,
      tenantId: authContext.tenantId
    });
    if (prefs?.keepLastTenMessages === true && prefs?.enableLongTermXaiMemory === true) {
      await resolveOrCreateUserBootstrapCollection({
        userId: authContext.userId.toHexString(),
        tenantId: authContext.tenantId.toHexString(),
        email: user.email
      });
    }
  } catch (historyCollectionError) {
    console.warn("[auth/email] per-user xChat history xAI collection non-fatal", {
      userId: authContext.userId.toHexString(),
      message:
        historyCollectionError instanceof Error
          ? historyCollectionError.message
          : String(historyCollectionError)
    });
  }

  const username = authContext.username ?? user.email.split("@")[0] ?? "user";

  await recordUserSuccessfulLogin({
    userId: user._id,
    clientIp: loginMeta?.clientIp,
    country: loginMeta?.country,
    userAgent: loginMeta?.userAgent,
    audit: {
      provider: "email_password",
      email: user.email,
      username
    }
  });

  await createSession({
    userId: authContext.userId.toHexString(),
    email: authContext.email,
    roles: normalizeCoreRoles(authContext.roles),
    tenantId: authContext.tenantId.toHexString(),
    tenantRole: authContext.tenantRole,
    xUserId: authContext.xUserId ?? "",
    username,
    displayName: authContext.displayName,
    avatarUrl: authContext.avatarUrl
  });
}
