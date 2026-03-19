/**
 * Seed-admin email match for OAuth / link-email bootstrap.
 * Returns false when `ADMIN_SEED_EMAIL` is unset or blank — no repository default,
 * so a copied `.env.example` cannot imply a guessable bootstrap address.
 */
export function isSeedAdminEmail(
  email: string,
  configuredAdminSeedEmail: string | undefined
): boolean {
  const configured = configuredAdminSeedEmail?.trim().toLowerCase();
  if (!configured) {
    return false;
  }
  return email.trim().toLowerCase() === configured;
}
