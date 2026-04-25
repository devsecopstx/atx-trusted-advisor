import type { CoreUser } from "@/modules/identity/types";

/**
 * MVP hook for welcome email after verify-email completion.
 * Real provider wiring can replace this without changing auth route contracts.
 */
export async function sendWelcomeEmailIfConfigured(user: CoreUser): Promise<void> {
  if (!user.email) {
    return;
  }
  // Intentionally safe no-op transport for now; keeps behavior deterministic in dev/test.
  console.info("[auth/email] welcome_email_pending", { email: user.email });
}
