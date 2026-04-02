/** Stable id stored on sessions / audit when the provider is Google OAuth. */
export function googleLinkedId(sub: string): string {
  return `google:${sub.trim()}`;
}

export function isGoogleLegacyXUserId(xUserId: string | undefined): boolean {
  return Boolean(xUserId?.startsWith("google:"));
}
