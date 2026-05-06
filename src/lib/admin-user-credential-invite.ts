import { resolveAccessApprovalNotifyEmail } from "@/lib/access-request-notify-email";
import { canUserLogin } from "@/modules/identity/authorization";
import type { CoreUser } from "@/modules/identity/types";

/**
 * Mirrors {@link ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY} parsing in `env.ts` without requiring a full `getEnv()`
 * parse — admin user serialization runs in tests and scripts that may not load the complete runtime env schema.
 */
function isAccessApprovalEmailSignInOnlyEnv(): boolean {
  const v = process.env.ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY;
  if (v === undefined || v === null || v === "") {
    return false;
  }
  if (typeof v === "boolean") {
    return v;
  }
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function resolveResendCredentialInviteDenial(user: CoreUser): string | null {
  if (isAccessApprovalEmailSignInOnlyEnv()) {
    return "Password invite emails are disabled (ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY).";
  }
  if (user.status === "suspended") {
    return "Cannot resend invite for a suspended user.";
  }
  if (!canUserLogin(user.roles)) {
    return "User has no login role yet; approve access before sending a password invite.";
  }
  if (user.passwordHash && user.passwordHash.length > 0) {
    return "User already has a password set.";
  }
  if (!resolveAccessApprovalNotifyEmail(user, {})) {
    return "No deliverable email on file (placeholder or missing).";
  }
  return null;
}

export type AdminUserCredentialInviteFields = {
  hasPassword: boolean;
  credentialInviteExpiresAt: string | null;
  resendPasswordInviteAvailable: boolean;
  resendPasswordInviteBlockedReason: string | null;
};

export function getAdminUserCredentialInviteFields(user: CoreUser): AdminUserCredentialInviteFields {
  const hasPassword = Boolean(user.passwordHash && user.passwordHash.length > 0);
  const credentialInviteExpiresAt =
    user.credentialInviteExpiresAt instanceof Date
      ? user.credentialInviteExpiresAt.toISOString()
      : null;
  const blockedReason = resolveResendCredentialInviteDenial(user);
  return {
    hasPassword,
    credentialInviteExpiresAt,
    resendPasswordInviteAvailable: blockedReason === null,
    resendPasswordInviteBlockedReason: blockedReason
  };
}

export function assertUserEligibleForCredentialInviteResend(user: CoreUser): string | null {
  return resolveResendCredentialInviteDenial(user);
}
