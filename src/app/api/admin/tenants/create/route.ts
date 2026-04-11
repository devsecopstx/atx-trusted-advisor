import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";
import { XF_BRAND_PALETTE_IDS } from "@/lib/tenant-branding-palette";
import { MAX_XF_HERO_ICON_URL_CHARS } from "@/lib/tenant-hero-icon-url";
import { MAX_XF_TENANT_LOGO_URL_CHARS } from "@/lib/tenant-logo-url";
import { parseTenantSpecV1Document, sanitizeWorkspaceLimitsPartial } from "@/lib/tenant-spec-v1-parse";
import { upsertTenantFromParsedSpecV1 } from "@/modules/platform/tenant-spec-apply";

const createTenantBodySchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  initialAdminEmail: z.string().optional(),
  initialAdminXUserId: z.string().max(64).optional(),
  initialAdminPlatformRole: z.enum(["advisor", "operator", "viewer"]).optional(),
  setAsDefaultSessionTenant: z.boolean().optional(),
  xfUiTheme: z.enum(["light", "dark", "system"]).optional(),
  xfBrandPalette: z.enum(XF_BRAND_PALETTE_IDS).optional(),
  xfHeroIconUrl: z.string().max(MAX_XF_HERO_ICON_URL_CHARS).optional(),
  xfAccentColor: z.string().max(32).optional(),
  xfTenantLogoUrl: z.string().max(MAX_XF_TENANT_LOGO_URL_CHARS).optional(),
  xfTenantTagline: z.string().max(60).optional(),
  /** Partial workspace limits — same validation as tenant-spec YAML (`sanitizeWorkspaceLimitsPartial`). */
  workspaceLimits: z.record(z.string(), z.unknown()).optional()
});

function bodyToSpecV1Doc(
  body: z.infer<typeof createTenantBodySchema>,
  workspaceLimits?: Record<string, unknown>
): { version: 1; tenant: Record<string, unknown> } {
  const tenant: Record<string, unknown> = {
    slug: body.slug.trim(),
    name: body.name.trim(),
    isDefault: false
  };

  const email = body.initialAdminEmail?.trim();
  if (email) {
    const block: Record<string, unknown> = { email };
    const xid = body.initialAdminXUserId?.trim();
    if (xid) {
      block.xUserId = xid;
    }
    if (body.initialAdminPlatformRole) {
      block.platformRole = body.initialAdminPlatformRole;
    }
    if (body.setAsDefaultSessionTenant !== undefined) {
      block.setAsDefaultSessionTenant = body.setAsDefaultSessionTenant;
    }
    tenant.initialTenantAdmin = block;
  }

  const tp: Record<string, unknown> = {
    xf_accent_color: normalizeXfAccentColor(body.xfAccentColor ?? DEFAULT_TENANT_ACCENT_HEX)
  };
  if (body.xfUiTheme) {
    tp.xf_ui_theme = body.xfUiTheme;
  }
  if (body.xfBrandPalette) {
    tp.xf_brand_palette = body.xfBrandPalette;
  }
  const hero = body.xfHeroIconUrl?.trim();
  if (hero) {
    tp.xf_hero_icon_url = hero;
  }
  const logo = body.xfTenantLogoUrl?.trim();
  if (logo) {
    tp.xf_tenant_logo_url = logo;
  }
  const tag = body.xfTenantTagline?.trim();
  if (tag) {
    tp.xf_tenant_tagline = tag.slice(0, 60);
  }
  tenant.tenantPreferences = tp;

  if (workspaceLimits && Object.keys(workspaceLimits).length > 0) {
    tenant.workspaceLimits = workspaceLimits;
  }

  return { version: 1, tenant };
}

/**
 * POST — create/upsert a tenant from the same contract as `generate:tenant-spec` + `seed:tenant`
 * (no YAML file; writes directly to the app MongoDB). **global_admin** only. **Not** BFF-proxied.
 */
export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = createTenantBodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  let workspaceLimitsForSpec: Record<string, unknown> | undefined;
  if (parsedBody.data.workspaceLimits !== undefined) {
    try {
      const w = sanitizeWorkspaceLimitsPartial(parsedBody.data.workspaceLimits);
      if (w && Object.keys(w).length > 0) {
        workspaceLimitsForSpec = w;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid workspaceLimits";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const specDoc = bodyToSpecV1Doc(parsedBody.data, workspaceLimitsForSpec);

  let parsedSpec;
  try {
    parsedSpec = parseTenantSpecV1Document(specDoc);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid tenant spec";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const db = await getDb();
    const result = await upsertTenantFromParsedSpecV1(db, parsedSpec);
    return NextResponse.json({
      data: {
        ...result,
        message:
          "Tenant upserted. Equivalent to npm run generate:tenant-spec (fields below) + npm run seed:tenant for this database."
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tenant create failed";
    const isConflict = msg.includes("already linked");
    return NextResponse.json({ error: msg }, { status: isConflict ? 409 : 500 });
  }
}
