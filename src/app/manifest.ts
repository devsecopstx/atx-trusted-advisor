import type { MetadataRoute } from "next";

import { getSessionUser } from "@/lib/auth";
import { getTenantShellBrandingForHexCached } from "@/lib/identity-shell-cache";

const DEFAULT_NAME = "aTx Advisor";
const DEFAULT_SHORT_NAME = "aTx";
const DEFAULT_THEME_COLOR = "#050505";

type ManifestIcon = {
  src: string;
  type: string;
  sizes: string;
  purpose?: "any" | "maskable" | "monochrome";
};

const DEFAULT_ICONS: ManifestIcon[] = [
  { src: "/icons/icon-48.webp", type: "image/webp", sizes: "48x48", purpose: "maskable" },
  { src: "/icons/icon-72.webp", type: "image/webp", sizes: "72x72", purpose: "maskable" },
  { src: "/icons/icon-96.webp", type: "image/webp", sizes: "96x96", purpose: "maskable" },
  { src: "/icons/icon-128.webp", type: "image/webp", sizes: "128x128", purpose: "maskable" },
  { src: "/icons/icon-192.webp", type: "image/webp", sizes: "192x192", purpose: "maskable" },
  { src: "/icons/icon-256.webp", type: "image/webp", sizes: "256x256", purpose: "maskable" },
  { src: "/icons/icon-512.webp", type: "image/webp", sizes: "512x512", purpose: "maskable" }
];

function normalizeShortName(name: string): string {
  const t = name.trim();
  if (!t) {
    return DEFAULT_SHORT_NAME;
  }
  return t.length > 12 ? `${t.slice(0, 11)}.` : t;
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const session = await getSessionUser();
  if (!session?.tenantId) {
    return {
      name: DEFAULT_NAME,
      short_name: DEFAULT_SHORT_NAME,
      description: "No Atoms Moved. Just Gains Earned.",
      start_url: "/xchat",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: DEFAULT_THEME_COLOR,
      theme_color: DEFAULT_THEME_COLOR,
      icons: DEFAULT_ICONS
    };
  }

  const branding = await getTenantShellBrandingForHexCached(session.tenantId);
  const tenantName = String(branding?.displayName ?? "").trim() || DEFAULT_NAME;
  const tenantLogo = String(branding?.logoUrl ?? "").trim();
  const accent = branding?.accentColor?.trim() || DEFAULT_THEME_COLOR;
  const tenantTagline = String(branding?.tagline ?? "").trim();
  const tenantLogoIcon: ManifestIcon = {
    src: tenantLogo,
    type: "image/png",
    sizes: "512x512",
    purpose: "maskable"
  };
  const icons = tenantLogo ? [tenantLogoIcon, ...DEFAULT_ICONS] : DEFAULT_ICONS;

  return {
    name: tenantName,
    short_name: normalizeShortName(tenantName),
    description: tenantTagline || "No Atoms Moved. Just Gains Earned.",
    start_url: "/xchat",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: DEFAULT_THEME_COLOR,
    theme_color: accent,
    icons
  };
}
