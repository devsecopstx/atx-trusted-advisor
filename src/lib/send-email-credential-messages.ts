import { sendDeskPlainEmail } from "@/lib/desk-smtp";
import { resolvePublicAppOrigin } from "@/lib/public-app-origin";

export async function sendAccessApprovedPasswordInviteEmail(input: {
  request: Request;
  to: string;
  rawToken: string;
  /** Optional greeting; falls back to "Valued Client" in body when omitted. */
  firstName?: string | null;
}): Promise<boolean> {
  const origin = resolvePublicAppOrigin(input.request);
  const setPasswordLink = `${origin}/login/set-password?token=${encodeURIComponent(input.rawToken)}`;
  const subject = "Welcome to aTx Finance – Your Account is Ready";
  const text = [
    `Dear ${input.firstName || "Valued Client"},`,
    "",
    "Your access request has been approved. Welcome to **aTx Finance**.",
    "",
    "We built aTx Finance as your personal command center for sophisticated portfolio management, xAI-powered conversational strategy (xChat), and institutional-grade options analysis (xOptions).",
    "",
    "To complete your setup and sign in with email + password, please set your secure password now:",
    "",
    setPasswordLink,
    "",
    "🔒 This secure link expires in **7 days**. For your protection, please do not forward or share it.",
    "",
    "Once signed in you will be able to immediately:",
    "• Connect and monitor multiple portfolios with real-time holdings, alerts, and performance",
    "• Engage xChat – your xAI co-pilot for market insights and tailored strategy ideas",
    "• Build, analyze, and stress-test options strategies (conservative income, balanced, or aggressive growth)",
    "",
    "If you have any questions or need onboarding assistance, simply reply to this email or use the in-app support.",
    "",
    "We look forward to helping you and your team make better, data-driven decisions.",
    "",
    "support@atxtrustedadvisory.com",
    "",
    "P.S. All communications are secured end-to-end and your data is never shared."
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

export async function sendEmailVerificationEmail(input: {
  request: Request;
  to: string;
  rawToken: string;
}): Promise<boolean> {
  const origin = resolvePublicAppOrigin(input.request);
  const link = `${origin}/login/verify-email?token=${encodeURIComponent(input.rawToken)}`;
  const subject = "Verify your email for aTx Finance";
  const text = [
    "Confirm your email to finish account activation.",
    "",
    "Open this link to verify your email (expires in 24 hours):",
    link,
    "",
    "If you did not request this, you can ignore this email."
  ].join("\n");
  return sendDeskPlainEmail({ to: input.to, subject, text });
}
