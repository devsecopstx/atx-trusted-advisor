import type { XfUiThemePreference } from "@/lib/xf-ui-theme";

/**
 * Optional tenant-level branding aliases (admin-set once).
 */
export type TenantBrandingPreferences = {
  xchat_brandname?: string;
  xstrategybuilder_brandname?: string;
};

/** Stored in `core_tenants.tenantPreferences` alongside branding keys. */
export type TenantPreferences = TenantBrandingPreferences & {
  /**
   * Controls whether this tenant may use its own `workspaceLimits` + `planOverrides`.
   * When false (default), runtime limit and billing-plan override resolution falls back to the
   * seeded default tenant (`atxfinance-core`).
   */
  workspace_limits_override_enabled?: boolean;
  /** When true, enables `[xchat/debug]` logs for this tenant (global_admin via Admin → Tenant workspace). */
  xchat_debug_enabled?: boolean;
  /**
   * Default shell density for users with no `localStorage` choice yet (`light` → soft, `dark` → deep, `system` → OS).
   * Stored string must be {@link XfUiThemePreference}.
   */
  xf_ui_theme?: XfUiThemePreference;
  /**
   * Accent preset for tenant-branded shells — see `XF_BRAND_PALETTE_IDS` in `tenant-branding-palette.ts`.
   * Product surfaces read this when applying tenant theme overrides.
   */
  xf_brand_palette?: string;
  /**
   * Hero / marketing icon: `https://…` URL, `http://127.0.0.1` / `localhost` for dev, or `data:image/*;base64,…` (size-capped).
   */
  xf_hero_icon_url?: string;
  /** Tenant accent for shell chrome (`--xf-tenant-accent`); hex `#rrggbb`. */
  xf_accent_color?: string;
  /** Logo for product header; https, loopback http, or data URL (larger cap than hero). */
  xf_tenant_logo_url?: string;
  /** Subtitle under tenant display name in shell (max 60 chars). */
  xf_tenant_tagline?: string;
  /**
   * xAI Management team collection id for this tenant’s xChat attachment uploads (provisioned on tenant create when
   * `XAI_TEAM_ID` + `XAI_MANAGEMENT_API_KEY` are set). Stable name: `xfinance-tenant-<slug>-xchat-attachments`.
   */
  xchat_team_attachments_collection_id?: string;
  /** Display name returned by xAI (see `buildTenantXchatAttachmentsCollectionName` in `tenant-xchat-team-collection.ts`). */
  xchat_team_attachments_collection_name?: string;
  /**
   * Per-tenant app-user route visibility overrides by catalog route id.
   * Example: `{ watchlist: false, xoptions: true }`.
   */
  app_user_route_visibility_overrides?: Record<string, boolean>;
  /**
   * Optional per-role default landing paths used when a role is redirected away from a disallowed route.
   * Example: `{ operator: "/portfolios", viewer: "/xchat" }`.
   */
  app_user_default_landing_path_by_role?: Record<string, string>;
  /** Opt-in bootstrap policy for provisioning default portfolio + watchlist for new approved users. */
  bootstrap_default_portfolio_watchlist?: boolean;
  /**
   * When true, access-request **approve** runs the same portfolio/watchlist bootstrap as first login.
   * Default false: lazy bootstrap on first successful OAuth / email session (`ensureTenantBootstrapForUser`).
   */
  bootstrap_on_approve?: boolean;
  /**
   * Structured per-role bootstrap (replaces legacy boolean when set). Persisted as BSON subdocument.
   * @see `tenant-bootstrap-policy.ts`
   */
  bootstrap_policy?: Record<string, unknown>;
  /** Optional tenant-wide watchlist seed symbols for operator/advisor when policy enables watchlist. */
  watchlist_seed_symbols?: string[];
  /**
   * Rolling **24h** xChat vendor spend alert: scheduled task **`xchat_spend_alert`** compares the sum of
   * **`xchat_logs.xaiUsage.costUsdTicks`** (from xAI `usage.cost_in_usd_ticks`) to this threshold (same units).
   * Omit or ≤0 to skip meaningful breach detection (task still runs but reports skipped).
   */
  xchat_daily_spend_alert_usd_ticks?: number;
  /**
   * Ambient **Market Veil** background animation on app_user product shells (initially `/xchat`, `/xoptions`, `/portfolios`).
   * - `undefined` (unset) or `true` → veil is rendered (default opt-in for paid tenants).
   * - `false` → veil is hidden for the entire tenant.
   * Read by `isAmbientMarketVeilEnabledForTenant` and surfaced through `WorkspaceTenantHeaderContext.ambientMarketVeilEnabled`.
   */
  ambient_market_veil?: boolean;
};

/**
 * Default-on resolver for the ambient market-veil background. Only `false` opts a
 * tenant out; missing/unset/null/true all enable the veil. Keeps copy-paths tiny
 * for page integration.
 */
export function isAmbientMarketVeilEnabledForTenant(
  tenant: { tenantPreferences?: TenantPreferences | null } | null | undefined
): boolean {
  return tenant?.tenantPreferences?.ambient_market_veil !== false;
}

/** Parse `tenantPreferences.ambient_market_veil` from admin PATCH (boolean or string). */
export function parseTenantAmbientMarketVeil(raw: unknown): boolean | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "string") {
    const t = raw.trim().toLowerCase();
    if (t === "true") {
      return true;
    }
    if (t === "false") {
      return false;
    }
  }
  return undefined;
}


const BRANDING_KEYS = ["xchat_brandname", "xstrategybuilder_brandname"] as const satisfies readonly (keyof TenantBrandingPreferences)[];

function sanitizeBrandName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 80);
}

export function parseTenantBrandingPreferencesPayload(
  raw: unknown
): { ok: true; value: Partial<TenantBrandingPreferences> } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "tenantPreferences must be an object" };
  }

  const input = raw as Record<string, unknown>;
  const value: Partial<TenantBrandingPreferences> = {};
  for (const key of BRANDING_KEYS) {
    if (input[key] === undefined) {
      continue;
    }
    const normalized = sanitizeBrandName(input[key]);
    if (!normalized) {
      continue;
    }
    value[key] = normalized;
  }
  return { ok: true, value };
}

/** Parse `tenantPreferences.xchat_debug_enabled` from admin PATCH (boolean or string). */
export function isTenantXchatDebugPreferenceEnabled(
  tenant: { tenantPreferences?: TenantPreferences | null } | null | undefined
): boolean {
  return tenant?.tenantPreferences?.xchat_debug_enabled === true;
}

export function parseTenantXchatDebugEnabled(raw: unknown): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "string") {
    const t = raw.trim().toLowerCase();
    if (t === "true") {
      return true;
    }
    if (t === "false") {
      return false;
    }
  }
  return undefined;
}
