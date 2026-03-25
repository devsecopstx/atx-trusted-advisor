/**
 * Loads `tenant_defaults.yaml` for `npm run seed:admin`. **Secrets in YAML are illustrative only** —
 * `.env` / Secret Manager wins when a variable is set. Same merge order for non-secrets.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

/** @param {...(string | undefined | null)} parts */
export function pickFirstNonEmpty(...parts) {
  for (const p of parts) {
    const t = typeof p === "string" ? p.trim() : "";
    if (t) {
      return t;
    }
  }
  return "";
}

/** @param {string | undefined} raw */
export function normalizeInstanceDeployTier(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "production" || s === "prod") {
    return "prod";
  }
  if (s === "staging" || s === "stage") {
    return "stage";
  }
  if (s === "deploy") {
    return "deploy";
  }
  if (s === "development" || s === "dev" || s === "") {
    return "dev";
  }
  const slug = s.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return (slug || "dev").slice(0, 32);
}

/** @param {string | undefined} raw */
export function slugifyInstanceSiteSegment(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (s || "atxfinance").slice(0, 64);
}

const MAX_ROOT_LEN = 96;

/** @param {string} root */
function clampRoot(root) {
  const t = root.trim().toLowerCase();
  return t.length > MAX_ROOT_LEN ? t.slice(0, MAX_ROOT_LEN) : t;
}

/**
 * @param {Record<string, string>} settings from initial_seed.settings
 * @param {import("yaml").ParsedNode | null} doc
 */
export function buildAtxInstanceCollectionRootFromTenantDoc(settings, doc) {
  const explicit = pickFirstNonEmpty(process.env.ATX_INSTANCE_COLLECTION_ROOT);
  if (explicit) {
    return clampRoot(explicit.toLowerCase().replace(/\s+/g, "-"));
  }

  const tier = pickFirstNonEmpty(
    process.env.ATX_DEPLOY_TARGET,
    process.env.ATX_INSTANCE_ENV,
    settings.atx_deploy_target,
    doc && typeof doc === "object" && doc !== null && "app" in doc
      ? String(/** @type {{ app?: { environment?: string } }} */ (doc).app?.environment ?? "")
      : "",
    "development"
  );

  const siteSlug = pickFirstNonEmpty(
    process.env.ATX_INSTANCE_SITE_SLUG,
    settings.site_name,
    "atxfinance"
  );

  const root = `atx-${normalizeInstanceDeployTier(tier)}-${slugifyInstanceSiteSegment(siteSlug)}`;
  return clampRoot(root);
}

/**
 * @param {string} repoRoot
 */
export function loadSeedTenantContext(repoRoot) {
  const path = join(repoRoot, "tenant_defaults.yaml");
  let doc = null;
  let yamlLoaded = false;
  if (existsSync(path)) {
    try {
      const text = readFileSync(path, "utf8");
      doc = parseYaml(text);
      yamlLoaded = true;
    } catch (e) {
      console.warn(
        "[seed:admin] tenant_defaults.yaml parse failed:",
        e instanceof Error ? e.message : e
      );
      doc = null;
    }
  }

  /** @type {Record<string, string>} */
  const settings = {};
  const rows = doc?.initial_seed?.settings;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row && typeof row === "object" && typeof row.key === "string") {
        const v = row.value;
        settings[row.key] = v === undefined || v === null ? "" : String(v);
      }
    }
  }

  const merged = {
    xaiApiKey: pickFirstNonEmpty(process.env.XAI_API_KEY, settings.xai_api_key),
    xaiMgmtKey: pickFirstNonEmpty(process.env.XAI_MANAGEMENT_API_KEY, settings.xai_api_management_key),
    xaiTeamId: pickFirstNonEmpty(process.env.XAI_TEAM_ID, settings.xai_team_id),
    xaiBaseUrl: pickFirstNonEmpty(
      process.env.XAI_BASE_URL,
      doc && typeof doc === "object" && doc !== null && "XAI_BASE_URL" in doc
        ? String(/** @type {{ XAI_BASE_URL?: string }} */ (doc).XAI_BASE_URL)
        : "",
      "https://api.x.ai/v1"
    ),
    xaiMgmtBaseUrl: pickFirstNonEmpty(
      process.env.XAI_MANAGEMENT_BASE_URL,
      doc && typeof doc === "object" && doc !== null && "XAI_MANAGEMENT_BASE_URL" in doc
        ? String(/** @type {{ XAI_MANAGEMENT_BASE_URL?: string }} */ (doc).XAI_MANAGEMENT_BASE_URL)
        : "",
      "https://management-api.x.ai/v1"
    ),
    adminSeedEmail: pickFirstNonEmpty(process.env.ADMIN_SEED_EMAIL, settings.admin_seed_email)
  };

  const atxInstanceCollectionRoot = buildAtxInstanceCollectionRootFromTenantDoc(settings, doc);
  const ragKbDisplayName = atxInstanceCollectionRoot ? `${atxInstanceCollectionRoot}-rag` : "";

  return {
    yamlLoaded,
    merged,
    atxInstanceCollectionRoot,
    ragKbDisplayName
  };
}
