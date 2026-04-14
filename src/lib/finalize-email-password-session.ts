import { createSession } from "@/lib/auth";
import type { ClientLoginMeta } from "@/lib/client-request-meta";
import { resolveOrCreateUserBootstrapCollection } from "@/modules/core-admin/access-request-bootstrap";
import { provisionDefaultPortfolioForUser } from "@/modules/core-admin/repository";
import { canUserLogin, normalizeCoreRoles } from "@/modules/identity/authorization";
import {
    recordUserSuccessfulLogin,
    resolveAuthContext
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";
import { isXchatUserHistoryXaiCollectionEnabled } from "@/modules/xchat/xchat-platform-settings";

export class EmailPasswordSessionError extends Error {
  constructor(
    public readonly code: "missing_user" | "not_authorized" | "suspended" | "no_tenant"
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
    await provisionDefaultPortfolioForUser({
      userId: authContext.userId.toHexString(),
      tenantId: authContext.tenantId.toHexString()
    });
  } catch (provisionError) {
    console.warn("[auth/email] default portfolio provision non-fatal", {
      userId: authContext.userId.toHexString(),
      message: provisionError instanceof Error ? provisionError.message : String(provisionError)
    });
  }

  if (isXchatUserHistoryXaiCollectionEnabled()) {
    try {
      await resolveOrCreateUserBootstrapCollection({
        userId: authContext.userId.toHexString(),
        tenantId: authContext.tenantId.toHexString(),
        email: user.email
      });
    } catch (historyCollectionError) {
      console.warn("[auth/email] per-user xChat history xAI collection non-fatal", {
        userId: authContext.userId.toHexString(),
        message:
          historyCollectionError instanceof Error
            ? historyCollectionError.message
            : String(historyCollectionError)
      });
    }
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
