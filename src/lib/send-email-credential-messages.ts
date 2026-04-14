import { sendDeskPlainEmail } from "@/lib/desk-smtp";
import { resolvePublicAppOrigin } from "@/lib/public-app-origin";

export async function sendAccessApprovedPasswordInviteEmail(input: {
  request: Request;
  to: string;
  rawToken: string;
}): Promise<boolean> {
  const origin = resolvePublicAppOrigin(input.request);
  const link = `${origin}/login/set-password?token=${encodeURIComponent(input.rawToken)}`;
  const subject = "Your xFinance access is approved — set your password";
  const text = [
    "Your access request was approved.",
    "",
    "Set your password to sign in with email:",
    link,
    "",
    "This link expires in 7 days. If you did not request access, ignore this email."
  ].join("\n");
  return sendDeskPlainEmail({ to: input.to, subject, text });
}

export async function sendPasswordResetEmail(input: {
  request: Request;
  to: string;
  rawToken: string;
}): Promise<boolean> {
  const origin = resolvePublicAppOrigin(input.request);
  const link = `${origin}/login/reset-password?token=${encodeURIComponent(input.rawToken)}`;
  const subject = "Reset your xFinance password";
  const text = [
    "We received a request to reset your password.",
    "",
    "Open this link to choose a new password (expires in 1 hour):",
    link,
    "",
    "If you did not request a reset, you can ignore this email."
  ].join("\n");
  return sendDeskPlainEmail({ to: input.to, subject, text });
}
