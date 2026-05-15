import { resolveAccessApprovalNotifyEmail } from "@/lib/access-request-notify-email";
import { canUserLogin } from "@/modules/identity/authorization";
import type { CoreUser } from "@/modules/identity/types";

function resolveResendEmailVerificationDenial(user: CoreUser): string | null {
  if (user.status === "suspended") {
    return "Cannot resend verification for a suspended user.";
  }
  if (!canUserLogin(user.roles)) {
    return "User has no login role yet; approve access before sending verification.";
  }
  if (!resolveAccessApprovalNotifyEmail(user, {})) {
    return "No deliverable email on file (placeholder or missing).";
  }
  return null;
}

export type AdminUserEmailVerificationResendFields = {
  resendEmailVerificationAvailable: boolean;
  resendEmailVerificationBlockedReason: string | null;
};

export function getAdminUserEmailVerificationResendFields(
  user: CoreUser
): AdminUserEmailVerificationResendFields {
  const blocked = resolveResendEmailVerificationDenial(user);
  return {
    resendEmailVerificationAvailable: blocked === null,
    resendEmailVerificationBlockedReason: blocked
  };
}

export function assertUserEligibleForEmailVerificationResend(user: CoreUser): string | null {
  return resolveResendEmailVerificationDenial(user);
}
