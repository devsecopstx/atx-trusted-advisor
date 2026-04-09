/** ~2.1MB base64 ceiling for tenant logo embeds (admin upload cap 2MB file). */
export const MAX_XF_TENANT_LOGO_URL_CHARS = 3_000_000;

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
 * Validates `tenantPreferences.xf_tenant_logo_url` — same rules as hero icon, larger size cap for logos.
 */
export function assertValidXfTenantLogoUrl(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new Error("xf_tenant_logo_url must be a string");
  }
  const s = raw.trim();
  if (!s) {
    throw new Error("xf_tenant_logo_url is empty");
  }
  if (s.length > MAX_XF_TENANT_LOGO_URL_CHARS) {
    throw new Error(
      `xf_tenant_logo_url exceeds ${MAX_XF_TENANT_LOGO_URL_CHARS} characters — use an https URL or a smaller image`
    );
  }

  if (s.startsWith("data:image/")) {
    const head = s.slice(0, 48).toLowerCase();
    const known = DATA_IMAGE_PREFIXES.some((p) => head.startsWith(p.toLowerCase()));
    if (!known) {
      throw new Error("xf_tenant_logo_url data URL must be PNG, JPEG, WebP, GIF, or SVG");
    }
    if (head.includes(";base64,")) {
      return s;
    }
    if (head.startsWith("data:image/svg+xml,")) {
      return s;
    }
    throw new Error("xf_tenant_logo_url raster data URLs must use base64 encoding");
  }

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("xf_tenant_logo_url must be a valid https URL, loopback http URL, or data:image URL");
  }
  if (u.protocol === "https:") {
    return s;
  }
  if (u.protocol === "http:" && isLocalHttpHostname(u.hostname)) {
    return s;
  }
  throw new Error("xf_tenant_logo_url must use https, or http only for localhost / 127.0.0.1");
}
