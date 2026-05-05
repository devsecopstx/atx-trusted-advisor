/**
 * Mirrors `scripts/lib/tenant-spec-schema.mjs` — keep validation in sync with
 * `generate:tenant-spec` / `seed:tenant` YAML specs.
 */

import { normalizeXfAccentColor } from "@/lib/tenant-accent-color";
import { isXfBrandPaletteId, XF_BRAND_PALETTE_IDS } from "@/lib/tenant-branding-palette";
import { assertValidXfHeroIconUrl } from "@/lib/tenant-hero-icon-url";
import { assertValidXfTenantLogoUrl } from "@/lib/tenant-logo-url";
import {
    parseTenantBootstrapPolicyFromUnknown,
    type TenantBootstrapPolicyV1
} from "@/modules/platform/tenant-bootstrap-policy";
import { parseTenantRentalProfile } from "@/modules/platform/tenant-rental-profile";
import type { TenantRentalProfile } from "@/modules/platform/tenant-rental-types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_SLUGS = new Set(["atxfinance-core"]);

const PROVISION_PLATFORM_ROLES = new Set(["advisor", "operator", "viewer"]);

const PROVISION_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WORKSPACE_LIMIT_NUM_KEYS = [
  "userXoptionsLimit",
  "userChatLimit",
  "tenantPortfolioLimit",
  "portfolioAccountLimit",
  "chatHistoryMax",
  "maxUsersPerTenant",
  "userTasksMax"
] as const;

const WORKSPACE_LIMIT_CHAT_HOURLY_KEY = "userChatHourlyLimit";

export function assertValidTenantSlug(slug: unknown): string {
  const s = typeof slug === "string" ? slug.trim() : "";
  if (!s) {
    throw new Error("tenant.slug is required");
  }
  if (s.length > 64) {
    throw new Error("tenant.slug must be at most 64 characters");
  }
  if (!SLUG_RE.test(s)) {
    throw new Error(
      "tenant.slug must be lowercase letters, digits, and single hyphens only (e.g. acme-advisors)"
    );
  }
  if (RESERVED_SLUGS.has(s)) {
    throw new Error(`tenant.slug "${s}" is reserved — use npm run seed:admin for the default tenant`);
  }
  return s;
}

export function assertValidTenantName(name: unknown): string {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) {
    throw new Error("tenant.name is required");
  }
  if (n.length > 256) {
    throw new Error("tenant.name must be at most 256 characters");
  }
  return n;
}

export function sanitizeWorkspaceLimitsPartial(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tenant.workspaceLimits must be an object");
  }
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of WORKSPACE_LIMIT_NUM_KEYS) {
    if (src[k] === undefined) {
      continue;
    }
    const n = Number(src[k]);
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
      throw new Error(`tenant.workspaceLimits.${k} must be an integer between 1 and 1000000`);
    }
    out[k] = n;
  }
  if (src[WORKSPACE_LIMIT_CHAT_HOURLY_KEY] !== undefined) {
    const n = Number(src[WORKSPACE_LIMIT_CHAT_HOURLY_KEY]);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
      throw new Error(
        `tenant.workspaceLimits.${WORKSPACE_LIMIT_CHAT_HOURLY_KEY} must be an integer between 0 and 1000000`
      );
    }
    out[WORKSPACE_LIMIT_CHAT_HOURLY_KEY] = n;
  }
  if (src.changePersonaEnabled !== undefined) {
    if (typeof src.changePersonaEnabled !== "boolean") {
      throw new Error("tenant.workspaceLimits.changePersonaEnabled must be a boolean");
    }
    out.changePersonaEnabled = src.changePersonaEnabled;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeProvisionEmail(email: unknown): string {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!e) {
    throw new Error("initialTenantAdmin.email is required");
  }
  if (e.length > 320) {
    throw new Error("initialTenantAdmin.email is too long");
  }
  if (!PROVISION_EMAIL_RE.test(e)) {
    throw new Error("initialTenantAdmin.email must look like an email address");
  }
  return e;
}

export function parseOptionalXUserId(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  let s = String(raw).trim();
  if (!s) {
    return undefined;
  }
  if (s.startsWith("@")) {
    s = s.slice(1);
  }
  if (!s) {
    return undefined;
  }
  if (s.length > 64) {
    throw new Error("initialTenantAdmin.xUserId must be at most 64 characters");
  }
  return s;
}

export function parseProvisionPlatformRole(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") {
    return "operator";
  }
  if (typeof raw !== "string") {
    throw new Error("initialTenantAdmin.platformRole must be a string");
  }
  const r = raw.trim().toLowerCase();
  if (!PROVISION_PLATFORM_ROLES.has(r)) {
    throw new Error('initialTenantAdmin.platformRole must be one of: "advisor", "operator", "viewer"');
  }
  return r;
}

export type ParsedInitialTenantAdmin = {
  email: string;
  xUserId?: string;
  platformRole: string;
  setAsDefaultSessionTenant: boolean;
};

export function parseInitialTenantAdmin(raw: unknown): ParsedInitialTenantAdmin | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tenant.initialTenantAdmin must be an object");
  }
  const o = raw as Record<string, unknown>;
  const email = normalizeProvisionEmail(o.email);
  const xUserId = parseOptionalXUserId(o.xUserId);
  const platformRole = parseProvisionPlatformRole(o.platformRole);
  let setAsDefaultSessionTenant = true;
  if (o.setAsDefaultSessionTenant !== undefined) {
    if (typeof o.setAsDefaultSessionTenant !== "boolean") {
      throw new Error("tenant.initialTenantAdmin.setAsDefaultSessionTenant must be a boolean");
    }
    setAsDefaultSessionTenant = o.setAsDefaultSessionTenant;
  }
  return { email, xUserId, platformRole, setAsDefaultSessionTenant };
}

export function sanitizeTenantPreferencesBrandingPartial(raw: unknown): Record<string, string> | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tenant.tenantPreferences must be an object");
  }
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["xchat_brandname", "xstrategybuilder_brandname"] as const) {
    if (src[key] === undefined) {
      continue;
    }
    if (typeof src[key] !== "string") {
      throw new Error(`tenant.tenantPreferences.${key} must be a string`);
    }
    const t = src[key].trim();
    if (!t) {
      continue;
    }
    out[key] = t.slice(0, 80);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseOptionalTenantXfUiTheme(tenantPrefs: unknown): "light" | "dark" | "system" | undefined {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = (tenantPrefs as Record<string, unknown>).xf_ui_theme;
  if (v === undefined || v === null) {
    return undefined;
  }
  const t = String(v).trim().toLowerCase();
  if (!t) {
    return undefined;
  }
  if (t !== "light" && t !== "dark" && t !== "system") {
    throw new Error('tenant.tenantPreferences.xf_ui_theme must be "light", "dark", or "system"');
  }
  return t;
}

/**
 * Optional accent preset for tenant shells (`tenantPreferences.xf_brand_palette`).
 */
export function parseOptionalXfBrandPalette(tenantPrefs: unknown): string | undefined {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = (tenantPrefs as Record<string, unknown>).xf_brand_palette;
  if (v === undefined || v === null) {
    return undefined;
  }
  const t = String(v).trim().toLowerCase();
  if (!t) {
    return undefined;
  }
  if (!isXfBrandPaletteId(t)) {
    throw new Error(
      `tenant.tenantPreferences.xf_brand_palette must be one of: ${XF_BRAND_PALETTE_IDS.join(", ")}`
    );
  }
  return t;
}

export function parseOptionalXfHeroIconUrl(tenantPrefs: unknown): string | undefined {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = (tenantPrefs as Record<string, unknown>).xf_hero_icon_url;
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v !== "string" || !String(v).trim()) {
    return undefined;
  }
  return assertValidXfHeroIconUrl(v);
}

export function parseOptionalXfAccentColor(tenantPrefs: unknown): string | undefined {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = (tenantPrefs as Record<string, unknown>).xf_accent_color;
  if (v === undefined || v === null) {
    return undefined;
  }
  const t = String(v).trim();
  if (!t) {
    return undefined;
  }
  return normalizeXfAccentColor(t);
}

export function parseOptionalXfTenantTagline(tenantPrefs: unknown): string | undefined {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = (tenantPrefs as Record<string, unknown>).xf_tenant_tagline;
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v !== "string") {
    throw new Error("xf_tenant_tagline must be a string");
  }
  const t = v.trim();
  if (!t) {
    return undefined;
  }
  if (t.length > 60) {
    throw new Error("xf_tenant_tagline must be at most 60 characters");
  }
  return t;
}

export function parseOptionalXfTenantLogoUrl(tenantPrefs: unknown): string | undefined {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = (tenantPrefs as Record<string, unknown>).xf_tenant_logo_url;
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v !== "string" || !String(v).trim()) {
    return undefined;
  }
  return assertValidXfTenantLogoUrl(v);
}

export function parseOptionalWatchlistSeedSymbols(tenantPrefs: unknown): string[] | undefined {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const raw = (tenantPrefs as Record<string, unknown>).watchlist_seed_symbols;
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new Error("tenant.tenantPreferences.watchlist_seed_symbols must be an array of strings");
  }
  const out = raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  if (out.length > 48) {
    throw new Error("tenant.tenantPreferences.watchlist_seed_symbols must have at most 48 symbols");
  }
  return out.length > 0 ? out : undefined;
}

export type ParsedTenantSpecV1 = {
  slug: string;
  name: string;
  workspaceLimits: Record<string, unknown> | undefined;
  initialTenantAdmin: ParsedInitialTenantAdmin | undefined;
  tenantPreferencesBranding: Record<string, string> | undefined;
  tenantXfUiTheme: "light" | "dark" | "system" | undefined;
  rentalProfile?: TenantRentalProfile;
  bootstrapPolicy?: TenantBootstrapPolicyV1;
  bootstrapOnApprove?: boolean;
  watchlistSeedSymbols?: string[];
};

export function parseTenantSpecV1Document(doc: unknown): ParsedTenantSpecV1 {
  if (!doc || typeof doc !== "object") {
    throw new Error("YAML root must be an object");
  }
  const root = doc as Record<string, unknown>;
  const version = root.version;
  if (version !== 1) {
    throw new Error(`Unsupported spec version: ${String(version)} (expected 1)`);
  }
  const tenant = root.tenant;
  if (!tenant || typeof tenant !== "object" || Array.isArray(tenant)) {
    throw new Error("Missing tenant: object");
  }
  const t = tenant as Record<string, unknown>;
  const slug = assertValidTenantSlug(t.slug);
  const name = assertValidTenantName(t.name);
  if (t.isDefault === true) {
    throw new Error(
      "tenant.isDefault must not be true in a spec file — default tenant is created by npm run seed:admin"
    );
  }
  const workspaceLimits = sanitizeWorkspaceLimitsPartial(t.workspaceLimits);
  const initialTenantAdmin = parseInitialTenantAdmin(t.initialTenantAdmin);
  const tenantPrefs = t.tenantPreferences;
  const tenantPreferencesBranding = sanitizeTenantPreferencesBrandingPartial(tenantPrefs);
  const tenantXfUiTheme = parseOptionalTenantXfUiTheme(tenantPrefs);
  const xfBrandPalette = parseOptionalXfBrandPalette(tenantPrefs);
  const xfHeroIconUrl = parseOptionalXfHeroIconUrl(tenantPrefs);
  const xfAccentColor = parseOptionalXfAccentColor(tenantPrefs);
  const xfTenantLogoUrl = parseOptionalXfTenantLogoUrl(tenantPrefs);
  const xfTenantTagline = parseOptionalXfTenantTagline(tenantPrefs);

  const brandingMerged: Record<string, string> = { ...(tenantPreferencesBranding ?? {}) };
  if (xfBrandPalette) {
    brandingMerged.xf_brand_palette = xfBrandPalette;
  }
  if (xfHeroIconUrl) {
    brandingMerged.xf_hero_icon_url = xfHeroIconUrl;
  }
  if (xfAccentColor) {
    brandingMerged.xf_accent_color = xfAccentColor;
  }
  if (xfTenantLogoUrl) {
    brandingMerged.xf_tenant_logo_url = xfTenantLogoUrl;
  }
  if (xfTenantTagline) {
    brandingMerged.xf_tenant_tagline = xfTenantTagline;
  }
  const mergedBranding = Object.keys(brandingMerged).length > 0 ? brandingMerged : undefined;

  const rentalProfile = parseTenantRentalProfile(t.rentalProfile);

  let bootstrapPolicy: TenantBootstrapPolicyV1 | undefined;
  if (t.bootstrapPolicy !== undefined && t.bootstrapPolicy !== null) {
    bootstrapPolicy = parseTenantBootstrapPolicyFromUnknown(t.bootstrapPolicy);
  }
  let bootstrapOnApprove: boolean | undefined;
  if (t.bootstrapOnApprove !== undefined) {
    if (typeof t.bootstrapOnApprove !== "boolean") {
      throw new Error("tenant.bootstrapOnApprove must be a boolean");
    }
    bootstrapOnApprove = t.bootstrapOnApprove;
  }
  const watchlistSeedSymbols = parseOptionalWatchlistSeedSymbols(tenantPrefs);

  return {
    slug,
    name,
    workspaceLimits,
    initialTenantAdmin,
    tenantPreferencesBranding: mergedBranding,
    tenantXfUiTheme,
    ...(rentalProfile ? { rentalProfile } : {}),
    ...(bootstrapPolicy ? { bootstrapPolicy } : {}),
    ...(bootstrapOnApprove !== undefined ? { bootstrapOnApprove } : {}),
    ...(watchlistSeedSymbols ? { watchlistSeedSymbols } : {})
  };
}
