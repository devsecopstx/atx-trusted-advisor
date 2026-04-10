/**
 * Shared validation + workspace limit sanitization for tenant YAML specs
 * (`generate-tenant-spec.mjs`, `seed-tenant-from-spec.mjs`).
 *
 * **Mirror:** `src/lib/tenant-spec-v1-parse.ts` (admin `POST /api/admin/tenants/create`) — keep rules in sync.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_SLUGS = new Set(["atxfinance-core"]);

/** @type {ReadonlySet<string>} */
const PROVISION_PLATFORM_ROLES = new Set(["advisor", "operator", "viewer"]);

const PROVISION_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @type {readonly string[]} */
const WORKSPACE_LIMIT_NUM_KEYS = [
  "userXoptionsLimit",
  "userChatLimit",
  "tenantPortfolioLimit",
  "portfolioAccountLimit",
  "chatHistoryMax"
];

const WORKSPACE_LIMIT_CHAT_HOURLY_KEY = "userChatHourlyLimit";

/**
 * @param {unknown} slug
 * @returns {string}
 */
export function assertValidTenantSlug(slug) {
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

/**
 * @param {unknown} name
 * @returns {string}
 */
export function assertValidTenantName(name) {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) {
    throw new Error("tenant.name is required");
  }
  if (n.length > 256) {
    throw new Error("tenant.name must be at most 256 characters");
  }
  return n;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | undefined}
 */
export function sanitizeWorkspaceLimitsPartial(raw) {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tenant.workspaceLimits must be an object");
  }
  const src = /** @type {Record<string, unknown>} */ (raw);
  /** @type {Record<string, unknown>} */
  const out = {};
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

/**
 * @param {unknown} email
 * @returns {string}
 */
export function normalizeProvisionEmail(email) {
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

/**
 * @param {unknown} raw
 * @returns {string | undefined}
 */
export function parseOptionalXUserId(raw) {
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

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function parseProvisionPlatformRole(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return "operator";
  }
  if (typeof raw !== "string") {
    throw new Error("initialTenantAdmin.platformRole must be a string");
  }
  const r = raw.trim().toLowerCase();
  if (!PROVISION_PLATFORM_ROLES.has(r)) {
    throw new Error(
      'initialTenantAdmin.platformRole must be one of: "advisor", "operator", "viewer"'
    );
  }
  return r;
}

/**
 * @param {unknown} raw
 * @returns {{ email: string, xUserId?: string, platformRole: string, setAsDefaultSessionTenant: boolean } | undefined}
 */
export function parseInitialTenantAdmin(raw) {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tenant.initialTenantAdmin must be an object");
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
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

/**
 * Branding keys only — does not set `xchat_debug_enabled` (admin UI / API).
 * @param {unknown} raw
 * @returns {Record<string, string> | undefined}
 */
export function sanitizeTenantPreferencesBrandingPartial(raw) {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tenant.tenantPreferences must be an object");
  }
  const src = /** @type {Record<string, unknown>} */ (raw);
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of ["xchat_brandname", "xstrategybuilder_brandname"]) {
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

/**
 * @param {unknown} tenantPrefs `tenant.tenantPreferences` node (optional)
 * @returns {"light" | "dark" | "system" | undefined}
 */
export function parseOptionalTenantXfUiTheme(tenantPrefs) {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = /** @type {Record<string, unknown>} */ (tenantPrefs).xf_ui_theme;
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

const XF_BRAND_PALETTE_IDS = new Set(["default", "violet", "cyan", "amber", "rose", "emerald"]);

const MAX_XF_HERO_ICON_URL_CHARS = 450_000;

const DATA_IMAGE_PREFIXES = [
  "data:image/png;",
  "data:image/jpeg;",
  "data:image/jpg;",
  "data:image/webp;",
  "data:image/gif;",
  "data:image/svg+xml;"
];

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function assertValidXfHeroIconUrl(raw) {
  if (typeof raw !== "string") {
    throw new Error("xf_hero_icon_url must be a string");
  }
  const s = raw.trim();
  if (!s) {
    throw new Error("xf_hero_icon_url is empty");
  }
  if (s.length > MAX_XF_HERO_ICON_URL_CHARS) {
    throw new Error(
      `xf_hero_icon_url exceeds ${MAX_XF_HERO_ICON_URL_CHARS} characters — host the image and use an https URL`
    );
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
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error("xf_hero_icon_url must be a valid https URL, loopback http URL, or data:image URL");
  }
  if (u.protocol === "https:") {
    return s;
  }
  if (u.protocol === "http:") {
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") {
      return s;
    }
  }
  throw new Error("xf_hero_icon_url must use https, or http only for localhost / 127.0.0.1");
}

const MAX_XF_TENANT_LOGO_URL_CHARS = 3_000_000;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function assertValidXfTenantLogoUrl(raw) {
  if (typeof raw !== "string") {
    throw new Error("xf_tenant_logo_url must be a string");
  }
  const s = raw.trim();
  if (!s) {
    throw new Error("xf_tenant_logo_url is empty");
  }
  if (s.length > MAX_XF_TENANT_LOGO_URL_CHARS) {
    throw new Error(`xf_tenant_logo_url exceeds ${MAX_XF_TENANT_LOGO_URL_CHARS} characters`);
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
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error("xf_tenant_logo_url must be a valid https URL, loopback http URL, or data:image URL");
  }
  if (u.protocol === "https:") {
    return s;
  }
  if (u.protocol === "http:") {
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") {
      return s;
    }
  }
  throw new Error("xf_tenant_logo_url must use https, or http only for localhost / 127.0.0.1");
}

const DEFAULT_TENANT_ACCENT_HEX = "#8b5cf6";
const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeXfAccentColor(raw) {
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
    return `#${m6[1].toLowerCase()}`;
  }
  const m3 = s.match(HEX3);
  if (m3) {
    const [r, g, b] = m3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  throw new Error("xf_accent_color must be a CSS hex color (#rgb or #rrggbb)");
}

/**
 * @param {unknown} tenantPrefs
 * @returns {string | undefined}
 */
export function parseOptionalXfAccentColor(tenantPrefs) {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = /** @type {Record<string, unknown>} */ (tenantPrefs).xf_accent_color;
  if (v === undefined || v === null) {
    return undefined;
  }
  const t = String(v).trim();
  if (!t) {
    return undefined;
  }
  return normalizeXfAccentColor(t);
}

/**
 * @param {unknown} tenantPrefs
 * @returns {string | undefined}
 */
export function parseOptionalXfTenantTagline(tenantPrefs) {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = /** @type {Record<string, unknown>} */ (tenantPrefs).xf_tenant_tagline;
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

/**
 * @param {unknown} tenantPrefs
 * @returns {string | undefined}
 */
export function parseOptionalXfTenantLogoUrl(tenantPrefs) {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = /** @type {Record<string, unknown>} */ (tenantPrefs).xf_tenant_logo_url;
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v !== "string" || !String(v).trim()) {
    return undefined;
  }
  return assertValidXfTenantLogoUrl(v);
}

/**
 * @param {unknown} tenantPrefs
 * @returns {string | undefined}
 */
export function parseOptionalXfBrandPalette(tenantPrefs) {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = /** @type {Record<string, unknown>} */ (tenantPrefs).xf_brand_palette;
  if (v === undefined || v === null) {
    return undefined;
  }
  const t = String(v).trim().toLowerCase();
  if (!t) {
    return undefined;
  }
  if (!XF_BRAND_PALETTE_IDS.has(t)) {
    throw new Error(
      `tenant.tenantPreferences.xf_brand_palette must be one of: ${[...XF_BRAND_PALETTE_IDS].join(", ")}`
    );
  }
  return t;
}

/**
 * @param {unknown} tenantPrefs
 * @returns {string | undefined}
 */
export function parseOptionalXfHeroIconUrl(tenantPrefs) {
  if (tenantPrefs === undefined || tenantPrefs === null) {
    return undefined;
  }
  if (typeof tenantPrefs !== "object" || Array.isArray(tenantPrefs)) {
    return undefined;
  }
  const v = /** @type {Record<string, unknown>} */ (tenantPrefs).xf_hero_icon_url;
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v !== "string" || !String(v).trim()) {
    return undefined;
  }
  return assertValidXfHeroIconUrl(v);
}

/**
 * Full v1 tenant spec document (YAML root).
 * @param {unknown} doc
 */
export function parseTenantSpecV1Document(doc) {
  if (!doc || typeof doc !== "object") {
    throw new Error("YAML root must be an object");
  }
  const root = /** @type {Record<string, unknown>} */ (doc);
  const version = root.version;
  if (version !== 1) {
    throw new Error(`Unsupported spec version: ${String(version)} (expected 1)`);
  }
  const tenant = root.tenant;
  if (!tenant || typeof tenant !== "object" || Array.isArray(tenant)) {
    throw new Error("Missing tenant: object");
  }
  const t = /** @type {Record<string, unknown>} */ (tenant);
  const slug = assertValidTenantSlug(t.slug);
  const name = assertValidTenantName(t.name);
  if (t.isDefault === true) {
    throw new Error(
      "tenant.isDefault must not be true in a spec file — default tenant is created by npm run seed:admin"
    );
  }
  const workspaceLimits = sanitizeWorkspaceLimitsPartial(t.workspaceLimits);
  const initialTenantAdmin = parseInitialTenantAdmin(t.initialTenantAdmin);
  const tp = t.tenantPreferences;
  const tenantPreferencesBranding = sanitizeTenantPreferencesBrandingPartial(tp);
  const tenantXfUiTheme = parseOptionalTenantXfUiTheme(tp);
  const xfBrandPalette = parseOptionalXfBrandPalette(tp);
  const xfHeroIconUrl = parseOptionalXfHeroIconUrl(tp);
  const xfAccentColor = parseOptionalXfAccentColor(tp);
  const xfTenantLogoUrl = parseOptionalXfTenantLogoUrl(tp);
  const xfTenantTagline = parseOptionalXfTenantTagline(tp);

  const brandingMerged = { ...(tenantPreferencesBranding ?? {}) };
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

  return {
    slug,
    name,
    workspaceLimits,
    initialTenantAdmin,
    tenantPreferencesBranding: mergedBranding,
    tenantXfUiTheme
  };
}
