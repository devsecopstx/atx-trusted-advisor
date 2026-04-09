/** Max stored length (~337KB base64) — keeps Mongo doc reasonable; use HTTPS hosting for large assets. */
export const MAX_XF_HERO_ICON_URL_CHARS = 450_000;

const DATA_IMAGE_PREFIXES = [
  "data:image/png;",
  "data:image/jpeg;",
  "data:image/jpg;",
  "data:image/webp;",
  "data:image/gif;",
  "data:image/svg+xml;"
] as const;

function isLocalHttpHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/**
 * Validates `tenantPreferences.xf_hero_icon_url`: https URL, or http for loopback only, or data:image/* (base64).
 */
export function assertValidXfHeroIconUrl(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new Error("xf_hero_icon_url must be a string");
  }
  const s = raw.trim();
  if (!s) {
    throw new Error("xf_hero_icon_url is empty");
  }
  if (s.length > MAX_XF_HERO_ICON_URL_CHARS) {
    throw new Error(`xf_hero_icon_url exceeds ${MAX_XF_HERO_ICON_URL_CHARS} characters — host the image and paste an https URL`);
  }

  if (s.startsWith("data:") && !s.toLowerCase().startsWith("data:image/")) {
    throw new Error("xf_hero_icon_url data URL must be image/png, jpeg, webp, gif, or svg+xml");
  }

  if (s.startsWith("data:image/")) {
    const head = s.slice(0, 48).toLowerCase();
    const known = DATA_IMAGE_PREFIXES.some((p) => head.startsWith(p.toLowerCase()));
    if (!known) {
      throw new Error("xf_hero_icon_url data URL must be image/png, jpeg, webp, gif, or svg+xml");
    }
    if (head.includes(";base64,")) {
      return s;
    }
    if (head.startsWith("data:image/svg+xml,")) {
      return s;
    }
    throw new Error("xf_hero_icon_url raster data URLs must use base64 encoding");
  }

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("xf_hero_icon_url must be a valid https URL, loopback http URL, or data:image URL");
  }
  if (u.protocol === "https:") {
    return s;
  }
  if (u.protocol === "http:" && isLocalHttpHostname(u.hostname)) {
    return s;
  }
  throw new Error("xf_hero_icon_url must use https, or http only for localhost / 127.0.0.1");
}
