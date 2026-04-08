#!/usr/bin/env node
/**
 * Interactive or flag-driven generator for `tenant-specs/<slug>.yaml`.
 * Usage:
 *   npm run generate:tenant-spec
 *   npm run generate:tenant-spec -- --slug acme --name "Acme LLC"
 *   npm run generate:tenant-spec -- --slug acme --name "Acme LLC" --email ops@acme.com --xid "123456789" --theme light
 *   npm run generate:tenant-spec -- --slug acme --name "Acme LLC" --out tenant-specs/acme.yaml
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { stringify } from "yaml";

import {
    assertValidTenantName,
    assertValidTenantSlug,
    normalizeProvisionEmail,
    parseOptionalTenantXfUiTheme,
    parseOptionalXUserId
} from "./lib/tenant-spec-schema.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const DEFAULT_DIR = join(REPO_ROOT, "tenant-specs");

function printHelp() {
  console.log(`generate-tenant-spec — write a tenant YAML for npm run seed:tenant

Usage:
  node scripts/generate-tenant-spec.mjs [options]

Options:
  --slug <id>     Tenant slug (e.g. acme-advisors)
  --name <text>   Display name
  --email <addr>  Initial tenant admin email (omit + non-interactive = no initialTenantAdmin block)
  --xid <id>      X REST API user id (often numeric) or @handle / username (optional)
  --theme <name>  tenantPreferences.xf_ui_theme: light | dark | system (optional)
  --out <path>    Output file (default: tenant-specs/<slug>.yaml)
  -h, --help      Show this help
`);
}

async function promptLine(rl, label, defaultValue = "") {
  const hint = defaultValue ? ` (${defaultValue})` : "";
  const raw = (await rl.question(`${label}${hint}: `)).trim();
  return raw || defaultValue;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      slug: { type: "string" },
      name: { type: "string" },
      email: { type: "string" },
      xid: { type: "string" },
      theme: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: false
  });

  if (values.help) {
    printHelp();
    return;
  }

  let slug = values.slug?.trim() ?? "";
  let name = values.name?.trim() ?? "";
  let outPath = values.out?.trim() ?? "";
  /** @type {string | null} null = not provided on CLI (prompt if TTY) */
  let adminEmailRaw = values.email !== undefined ? String(values.email).trim() : null;
  /** @type {string | null} */
  let xidRaw = values.xid !== undefined ? String(values.xid).trim() : null;
  /** @type {string | null} null = not provided on CLI (prompt if TTY) */
  let themeRaw = values.theme !== undefined ? String(values.theme).trim() : null;

  const needSlug = !slug;
  const needName = !name;
  const needEmailPrompt = adminEmailRaw === null;
  const needXidPrompt = xidRaw === null;
  const needThemePrompt = themeRaw === null;
  const useRl = needSlug || needName || needEmailPrompt || needXidPrompt || needThemePrompt;

  if (useRl) {
    if (!input.isTTY) {
      if (needSlug || needName) {
        console.error(
          "Non-interactive mode: pass --slug and --name. Optional: --email, --xid (omit --email to skip initialTenantAdmin)."
        );
        process.exit(1);
      }
      if (needEmailPrompt) {
        adminEmailRaw = "";
      }
      if (needXidPrompt) {
        xidRaw = "";
      }
      if (needThemePrompt) {
        themeRaw = "";
      }
    } else {
      const rl = readline.createInterface({ input, output });
      console.log(
        "Tenant spec generator — prompts for slug, name, initial admin email, optional X id/handle, optional shell theme.\n"
      );
      if (needSlug) {
        slug = await promptLine(rl, "Tenant slug (lowercase, hyphens)", "");
      }
      if (needName) {
        name = await promptLine(rl, "Display name", "");
      }
      if (needEmailPrompt) {
        adminEmailRaw = await promptLine(
          rl,
          "Initial tenant admin email (empty to skip initialTenantAdmin block)",
          ""
        );
      }
      if (needXidPrompt) {
        xidRaw = await promptLine(
          rl,
          "X id or @handle — REST API user id (often numeric) or username, e.g. Somegoodnewsatx (empty to skip)",
          ""
        );
      }
      if (needThemePrompt) {
        themeRaw = await promptLine(
          rl,
          "Default shell theme: light | dark | system (empty to skip — maps to xf_ui_theme)",
          ""
        );
      }
      rl.close();
    }
  }

  slug = assertValidTenantSlug(slug);
  name = assertValidTenantName(name);

  /** @type {{ email: string, xUserId?: string } | undefined} */
  let initialTenantAdmin;
  if (adminEmailRaw) {
    const email = normalizeProvisionEmail(adminEmailRaw);
    const xUserId = parseOptionalXUserId(xidRaw === null ? undefined : xidRaw || undefined);
    initialTenantAdmin = { email };
    if (xUserId) {
      initialTenantAdmin.xUserId = xUserId;
    }
  }

  const absOut = resolveOutputPath(outPath, slug);
  mkdirSync(dirname(absOut), { recursive: true });

  const tenant = {
    slug,
    name,
    isDefault: false
  };
  if (initialTenantAdmin) {
    tenant.initialTenantAdmin = initialTenantAdmin;
  }

  const xfUiTheme =
    themeRaw && String(themeRaw).trim()
      ? parseOptionalTenantXfUiTheme({ xf_ui_theme: themeRaw })
      : undefined;
  if (xfUiTheme) {
    tenant.tenantPreferences = { xf_ui_theme: xfUiTheme };
  }

  const doc = {
    version: 1,
    tenant
  };

  const yaml = stringify(doc, { lineWidth: 100 });
  const banner = `# Generated by generate-tenant-spec — ${new Date().toISOString()}\n# Apply: npm run seed:tenant -- --file ${relativePathForBanner(absOut)}\n\n`;

  writeFileSync(absOut, banner + yaml, "utf8");
  console.log(`Wrote ${absOut}`);
}

/**
 * @param {string} outFlag
 * @param {string} slug
 */
function resolveOutputPath(outFlag, slug) {
  const trimmed = outFlag.trim();
  if (!trimmed) {
    mkdirSync(DEFAULT_DIR, { recursive: true });
    return join(DEFAULT_DIR, `${slug}.yaml`);
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return join(REPO_ROOT, trimmed);
}

/**
 * @param {string} absOut
 */
function relativePathForBanner(absOut) {
  const rel = absOut.startsWith(REPO_ROOT) ? absOut.slice(REPO_ROOT.length + 1) : absOut;
  return rel;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
