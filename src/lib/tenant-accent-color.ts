/** Default tenant accent (trusted-advisor violet, matches xOptions institutional accent). */
export const DEFAULT_TENANT_ACCENT_HEX = "#8b5cf6";

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

/**
 * Normalizes `tenantPreferences.xf_accent_color` to lowercase `#rrggbb`.
 */
export function normalizeXfAccentColor(raw: unknown): string {
  if (raw === undefined || raw === null) {
    return DEFAULT_TENANT_ACCENT_HEX;
  }
  if (typeof raw !== "string") {
    throw new Error("xf_accent_color must be a string");
  }
  const s = raw.trim();
  if (!s) {
    return DEFAULT_TENANT_ACCENT_HEX;
  }
  const m6 = s.match(HEX6);
  if (m6) {
    return `#${m6[1]!.toLowerCase()}`;
  }
  const m3 = s.match(HEX3);
  if (m3) {
    const [r, g, b] = m3[1]!.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  throw new Error('xf_accent_color must be a CSS hex color (#rgb or #rrggbb)');
}
