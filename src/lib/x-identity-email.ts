/**
 * X OAuth users without a real email get a synthetic placeholder used in `core_users.email`.
 * Admin UIs should prefer username / xUserId over displaying these addresses.
 */
const LEGACY_X_IDENTITY_PLACEHOLDER_DOMAIN = "@x.identity.local";
const X_IDENTITY_PLACEHOLDER_DOMAIN = "@x.oauth.local";
const X_IDENTITY_PLACEHOLDER_PREFIX = "xlogin-";

export function isXIdentityPlaceholderEmail(email: string | undefined): boolean {
  if (!email) {
    return false;
  }
  const normalized = email.toLowerCase();
  return (
    normalized.endsWith(X_IDENTITY_PLACEHOLDER_DOMAIN) ||
    normalized.endsWith(LEGACY_X_IDENTITY_PLACEHOLDER_DOMAIN)
  );
}

export function buildXIdentityPlaceholderEmail(xUserId: string): string {
  return `${X_IDENTITY_PLACEHOLDER_PREFIX}${xUserId.toLowerCase()}${X_IDENTITY_PLACEHOLDER_DOMAIN}`;
}

export type UserFacingIdentityFields = {
  email?: string;
  username?: string;
  displayName?: string;
  xUserId?: string;
};

/**
 * Primary line for admin lists: real email, else @username, else xUserId, else Mongo user id.
 */
export function formatUserFacingIdentityLabel(
  user: UserFacingIdentityFields | undefined,
  fallbackUserId: string
): string {
  const email = user?.email?.trim();
  if (email && !isXIdentityPlaceholderEmail(email)) {
    return email;
  }
  const username = user?.username?.trim();
  if (username) {
    return username.startsWith("@") ? username : `@${username}`;
  }
  const xUserId = user?.xUserId?.trim();
  if (xUserId) {
    return xUserId;
  }
  return fallbackUserId;
}
