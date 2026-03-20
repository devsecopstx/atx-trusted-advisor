/**
 * X OAuth users without a real email get a synthetic placeholder used in `core_users.email`.
 * Admin UIs should prefer username / xUserId over displaying these addresses.
 */
export function isXIdentityPlaceholderEmail(email: string | undefined): boolean {
  if (!email) {
    return false;
  }
  return email.toLowerCase().endsWith("@x.identity.local");
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
