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
