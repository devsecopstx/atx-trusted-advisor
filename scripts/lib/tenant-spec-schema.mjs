/**
 * Shared validation + workspace limit sanitization for tenant YAML specs
 * (`generate-tenant-spec.mjs`, `seed-tenant-from-spec.mjs`).
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
  const tenantPreferencesBranding = sanitizeTenantPreferencesBrandingPartial(t.tenantPreferences);
  const tenantXfUiTheme = parseOptionalTenantXfUiTheme(t.tenantPreferences);
  return {
    slug,
    name,
    workspaceLimits,
    initialTenantAdmin,
    tenantPreferencesBranding,
    tenantXfUiTheme
  };
}
