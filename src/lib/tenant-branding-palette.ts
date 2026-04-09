/** Stored as `core_tenants.tenantPreferences.xf_brand_palette` — drives accent tokens in product shells (when wired). */
export const XF_BRAND_PALETTE_IDS = [
  "default",
  "violet",
  "cyan",
  "amber",
  "rose",
  "emerald"
] as const;

export type XfBrandPaletteId = (typeof XF_BRAND_PALETTE_IDS)[number];

export const XF_BRAND_PALETTE_LABELS: Record<XfBrandPaletteId, string> = {
  default: "Default — gain green + lightning yellow (kit)",
  violet: "Violet — xOptions-style institutional accent",
  cyan: "Cyan — cool tech accent",
  amber: "Amber — warm lightning-forward",
  rose: "Rose — soft contrast accent",
  emerald: "Emerald — marketing emerald tone"
};

export function isXfBrandPaletteId(raw: string): raw is XfBrandPaletteId {
  return (XF_BRAND_PALETTE_IDS as readonly string[]).includes(raw);
}
