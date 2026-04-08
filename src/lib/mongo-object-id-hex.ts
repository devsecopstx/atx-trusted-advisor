const HEX24 = /^[0-9a-fA-F]{24}$/;

/**
 * Mongo ObjectId hex from URLs/query params is often lowercase in DB/UI but links may use mixed case.
 * Normalize 24-char hex to lowercase so Set/has lookups match `ObjectId.toHexString()`.
 */
export function canonicalMongoObjectIdHex(raw: string): string {
  const t = raw.trim();
  return HEX24.test(t) ? t.toLowerCase() : t;
}

export function isLikelyMongoObjectIdHex(raw: string): boolean {
  return HEX24.test(raw.trim());
}

/**
 * Normalize ids from URLs, cookies, or JSON before comparing to `ObjectId.toHexString()` (always lowercase).
 * Non–24-char hex strings are returned trimmed only.
 */
export function normalizeMongoObjectIdParam(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  return isLikelyMongoObjectIdHex(t) ? canonicalMongoObjectIdHex(t) : t;
}

/**
 * User-facing tenant hint: hide the ObjectId prefix, show only the last 4 hex chars (e.g. `···a3f1`).
 * Full id remains available via `title` on the element. Use on xChat / xOptions / portfolio headers and rail.
 */
export function tenantIdHexLastFourUserFacing(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  if (HEX24.test(t)) {
    return `···${t.toLowerCase().slice(-4)}`;
  }
  if (t.length <= 4) {
    return t;
  }
  return `···${t.slice(-4)}`;
}

/** Collapsed rail / sidebar preview (e.g. tenant ObjectId) — not reversible to the full id without the open panel. */
export function redactMongoObjectIdForSidebarPreview(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  if (HEX24.test(t)) {
    const h = t.toLowerCase();
    return `${h.slice(0, 4)}…${h.slice(-4)}`;
  }
  if (t.length <= 8) {
    return `${t.slice(0, 2)}…`;
  }
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
