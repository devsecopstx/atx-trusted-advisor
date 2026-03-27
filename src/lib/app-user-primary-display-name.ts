/** Primary greeting / rail label: display name, @username, or email local-part. */
export function appUserPrimaryDisplayName(session: {
  displayName?: string;
  username: string;
  email: string;
}): string {
  const d = session.displayName?.trim();
  if (d) return d;
  const u = session.username?.trim();
  if (u) return u.startsWith("@") ? u.slice(1) : u;
  const local = session.email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "there";
}
