"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";
import { XF_BRAND_PALETTE_IDS, XF_BRAND_PALETTE_LABELS, type XfBrandPaletteId } from "@/lib/tenant-branding-palette";

const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024;
const ACCEPT_IMAGE = "image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif";

/** Example keys — server validates like tenant-spec YAML; omit or leave empty to use defaults after upsert. */
const WORKSPACE_LIMITS_JSON_PLACEHOLDER = `{
  "userChatLimit": 100,
  "userXoptionsLimit": 20,
  "tenantPortfolioLimit": 3,
  "portfolioAccountLimit": 5,
  "userChatHourlyLimit": 0
}`;

const ROUTE_OVERRIDES_JSON_PLACEHOLDER = `{
  "watchlist": false,
  "xoptions": true
}`;

const DEFAULT_LANDING_JSON_PLACEHOLDER = `{
  "advisor": "/xchat",
  "operator": "/portfolios",
  "viewer": "/xchat"
}`;

type CreateTenantResponse = {
  data: {
    tenantId: string;
    slug: string;
    name: string;
    provisionedInitialAdmin: boolean;
    message: string;
    /** When `XAI_TEAM_ID` + management key are set — team collection for xChat uploads. */
    xchatTeamAttachments?: {
      collectionId: string;
      collectionName: string;
      alreadyConfigured: boolean;
    };
  };
};

type LogoSource = "file" | "url";

function normalizeHexForInput(hex: string): string {
  const t = hex.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) {
    return t.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(t)) {
    const [, a, b, c] = t.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)!;
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return t;
}

function hexForColorInput(hex: string): string {
  const n = normalizeHexForInput(hex);
  return /^#[0-9a-f]{6}$/i.test(n) ? n : DEFAULT_TENANT_ACCENT_HEX;
}

export function CreateTenantConsole() {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [accentHex, setAccentHex] = useState(DEFAULT_TENANT_ACCENT_HEX);
  const [logoSource, setLogoSource] = useState<LogoSource>("file");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [tagline, setTagline] = useState("");
  const [xfUiTheme, setXfUiTheme] = useState<"" | "light" | "dark" | "system">("");
  const [xfBrandPalette, setXfBrandPalette] = useState<"" | XfBrandPaletteId>("");
  const [bootstrapDefaultPortfolioWatchlist, setBootstrapDefaultPortfolioWatchlist] = useState(false);

  const [initialAdminEmail, setInitialAdminEmail] = useState("");
  const [initialAdminXUserId, setInitialAdminXUserId] = useState("");
  const [initialAdminPlatformRole, setInitialAdminPlatformRole] = useState<"advisor" | "operator" | "viewer">(
    "operator"
  );
  const [setAsDefaultSessionTenant, setSetAsDefaultSessionTenant] = useState(true);

  const [workspaceLimitsJson, setWorkspaceLimitsJson] = useState("");
  const [routeOverridesJson, setRouteOverridesJson] = useState("");
  const [defaultLandingJson, setDefaultLandingJson] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<CreateTenantResponse["data"] | null>(null);

  const resolvedLogoPreview = useMemo(() => {
    if (logoSource === "url") {
      return logoUrl.trim() || null;
    }
    return logoDataUrl;
  }, [logoSource, logoUrl, logoDataUrl]);

  const previewName = name.trim() || "Your organization";
  const previewTagline = tagline.trim() || null;

  const onLogoFile = useCallback((fileList: FileList | null) => {
    setLogoError(null);
    const file = fileList?.[0];
    if (!file) {
      setLogoDataUrl(null);
      setLogoFileName(null);
      return;
    }
    if (file.size > MAX_LOGO_FILE_BYTES) {
      setLogoDataUrl(null);
      setLogoFileName(null);
      setLogoError(`File must be ${MAX_LOGO_FILE_BYTES / (1024 * 1024)} MB or smaller.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") {
        setLogoDataUrl(r);
        setLogoFileName(file.name);
      }
    };
    reader.onerror = () => {
      setLogoError("Could not read file.");
      setLogoDataUrl(null);
      setLogoFileName(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearLogo = useCallback(() => {
    setLogoDataUrl(null);
    setLogoFileName(null);
    setLogoUrl("");
    setLogoError(null);
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setStatus("Creating…");
    setError(null);
    setLastOk(null);
    try {
      let normalizedAccent: string;
      try {
        normalizedAccent = normalizeXfAccentColor(accentHex);
      } catch {
        setStatus(null);
        setError("Accent color must be a valid hex value (#rgb or #rrggbb).");
        return;
      }
      const body: Record<string, unknown> = {
        slug: slug.trim(),
        name: name.trim(),
        xfAccentColor: normalizedAccent
      };

      const logoPayload =
        logoSource === "url" ? logoUrl.trim() || undefined : logoDataUrl ?? undefined;
      if (logoPayload) {
        body.xfTenantLogoUrl = logoPayload;
      }

      if (tagline.trim()) {
        body.xfTenantTagline = tagline.trim().slice(0, 60);
      }
      if (xfUiTheme) {
        body.xfUiTheme = xfUiTheme;
      }
      if (xfBrandPalette) {
        body.xfBrandPalette = xfBrandPalette;
      }
      body.bootstrapDefaultPortfolioWatchlist = bootstrapDefaultPortfolioWatchlist;

      const email = initialAdminEmail.trim();
      if (email) {
        body.initialAdminEmail = email;
        const xid = initialAdminXUserId.trim();
        if (xid) {
          body.initialAdminXUserId = xid;
        }
        body.initialAdminPlatformRole = initialAdminPlatformRole;
        body.setAsDefaultSessionTenant = setAsDefaultSessionTenant;
      }

      const wlTrim = workspaceLimitsJson.trim();
      if (wlTrim) {
        let parsedWl: unknown;
        try {
          parsedWl = JSON.parse(wlTrim) as unknown;
        } catch {
          setStatus(null);
          setError("Workspace limits: invalid JSON.");
          return;
        }
        if (parsedWl === null || typeof parsedWl !== "object" || Array.isArray(parsedWl)) {
          setStatus(null);
          setError("Workspace limits JSON must be a single object.");
          return;
        }
        body.workspaceLimits = parsedWl as Record<string, unknown>;
      }

      const routeOverridesTrim = routeOverridesJson.trim();
      if (routeOverridesTrim) {
        let parsedOverrides: unknown;
        try {
          parsedOverrides = JSON.parse(routeOverridesTrim) as unknown;
        } catch {
          setStatus(null);
          setError("Route visibility overrides: invalid JSON.");
          return;
        }
        if (
          parsedOverrides === null ||
          typeof parsedOverrides !== "object" ||
          Array.isArray(parsedOverrides)
        ) {
          setStatus(null);
          setError("Route visibility overrides JSON must be an object map.");
          return;
        }
        body.appUserRouteVisibilityOverrides = parsedOverrides as Record<string, boolean>;
      }

      const defaultLandingTrim = defaultLandingJson.trim();
      if (defaultLandingTrim) {
        let parsedLanding: unknown;
        try {
          parsedLanding = JSON.parse(defaultLandingTrim) as unknown;
        } catch {
          setStatus(null);
          setError("Default landing by role: invalid JSON.");
          return;
        }
        if (parsedLanding === null || typeof parsedLanding !== "object" || Array.isArray(parsedLanding)) {
          setStatus(null);
          setError("Default landing by role JSON must be an object map.");
          return;
        }
        body.defaultLandingPathByRole = parsedLanding as Record<string, string>;
      }

      const res = await fetch("/api/admin/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await parseJson<CreateTenantResponse>(res);
      const data = json.data;
      setLastOk(data);
      const xchat =
        data.xchatTeamAttachments != null
          ? ` xChat attachments KB: ${data.xchatTeamAttachments.collectionName} (${data.xchatTeamAttachments.collectionId})${
              data.xchatTeamAttachments.alreadyConfigured ? " — already linked." : "."
            }`
          : "";
      setStatus(`Created / updated tenant “${data.slug}” (${data.tenantId}).${xchat}`);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, [
    slug,
    name,
    accentHex,
    logoSource,
    logoUrl,
    logoDataUrl,
    tagline,
    xfUiTheme,
    xfBrandPalette,
    bootstrapDefaultPortfolioWatchlist,
    initialAdminEmail,
    initialAdminXUserId,
    initialAdminPlatformRole,
    setAsDefaultSessionTenant,
    workspaceLimitsJson,
    routeOverridesJson,
    defaultLandingJson
  ]);

  const fieldClass =
    "rounded border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[var(--xf-surface-800)] px-3 py-2 text-sm text-[var(--xf-text-100)]";

  return (
    <section className="panel stack-gap">
      <div className="panel-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>New tenant</h2>
          <p className="status-text text-sm">
            Slug and display name are required. Set optional workspace JSON below, or use{" "}
            <strong>Workspace limits</strong> on the tenant after create.
          </p>
        </div>
        <Link className="cta cta-secondary text-sm" href="/admin/tenant-register">
          ← Tenant register
        </Link>
      </div>

      <p className="status-text text-xs text-[var(--xf-text-400)]">
        Branding and quotas can be changed anytime — use the tenant&apos;s Workspace limits page for the full form and
        plan overrides.
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_min(100%,280px)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <details className="group rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-surface-800)_40%,transparent)] p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-[var(--xf-text-100)]">
              1 · Basic information
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Tenant slug</span>
                <input
                  className={`${fieldClass} font-mono`}
                  autoComplete="off"
                  placeholder="acme-advisors"
                  value={slug}
                  onChange={(ev) => setSlug(ev.target.value)}
                />
                <span className="status-text text-xs">Lowercase, digits, single hyphens (max 64).</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Display name</span>
                <input
                  className={fieldClass}
                  autoComplete="organization"
                  placeholder="Acme Advisors LLC"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                />
              </label>
            </div>
          </details>

          <details className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-surface-800)_40%,transparent)] p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-[var(--xf-text-100)]">
              2 · Branding
            </summary>
            <div className="mt-4 flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Accent color</span>
                  <input
                    aria-label="Accent color"
                    className="h-10 w-14 cursor-pointer rounded border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-transparent"
                    type="color"
                    value={hexForColorInput(accentHex)}
                    onChange={(ev) => setAccentHex(ev.target.value)}
                  />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--xf-text-400)]">Hex</span>
                  <input
                    className={`${fieldClass} w-36 font-mono`}
                    spellCheck={false}
                    value={accentHex}
                    onChange={(ev) => setAccentHex(ev.target.value)}
                  />
                </div>
                <span
                  className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--xf-bg-900)]"
                  style={{ backgroundColor: hexForColorInput(accentHex) }}
                >
                  aTx
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Tenant logo</span>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={logoSource === "file"}
                      name="logo-source"
                      type="radio"
                      onChange={() => setLogoSource("file")}
                    />
                    Upload file
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={logoSource === "url"}
                      name="logo-source"
                      type="radio"
                      onChange={() => setLogoSource("url")}
                    />
                    Image URL
                  </label>
                </div>
                {logoSource === "file" ? (
                  <div className="flex flex-col gap-2">
                    <input
                      accept={ACCEPT_IMAGE}
                      className="text-sm text-[var(--xf-text-300)] file:mr-3 file:rounded file:border-0 file:bg-[var(--xf-surface-600)] file:px-3 file:py-1.5 file:text-[var(--xf-text-100)]"
                      type="file"
                      onChange={(ev) => onLogoFile(ev.target.files)}
                    />
                    <span className="status-text text-xs">
                      PNG, JPG, SVG, WebP, or GIF · max {MAX_LOGO_FILE_BYTES / (1024 * 1024)} MB · square ~512×512
                      recommended
                      {logoFileName ? ` · ${logoFileName}` : ""}
                    </span>
                  </div>
                ) : (
                  <input
                    className={fieldClass}
                    placeholder="https://… or http://127.0.0.1/… for local"
                    value={logoUrl}
                    onChange={(ev) => setLogoUrl(ev.target.value)}
                  />
                )}
                {logoError ? <p className="text-sm text-[var(--xf-warning-400)]">{logoError}</p> : null}
                {resolvedLogoPreview ? (
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URLs + tenant CDNs */}
                    <img
                      alt="Logo preview"
                      className="h-16 w-16 rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_15%,transparent)] object-contain"
                      src={resolvedLogoPreview}
                    />
                    <button className="cta cta-secondary text-xs" type="button" onClick={clearLogo}>
                      Remove logo
                    </button>
                  </div>
                ) : null}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Tagline / subtitle (optional)</span>
                <input
                  className={fieldClass}
                  maxLength={60}
                  placeholder="e.g. Family Office"
                  value={tagline}
                  onChange={(ev) => setTagline(ev.target.value.slice(0, 60))}
                />
                <span className="status-text text-xs">
                  Appears under the display name in the shell (max 60 characters). {tagline.length}/60
                </span>
              </label>
            </div>
          </details>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] p-4">
            <legend className="px-1 text-sm font-semibold">3 · Initial tenant admin (optional)</legend>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--xf-text-300)]">Email</span>
              <input
                className={fieldClass}
                autoComplete="email"
                placeholder="ops@acme.com (empty = skip)"
                value={initialAdminEmail}
                onChange={(ev) => setInitialAdminEmail(ev.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--xf-text-300)]">X user id or @handle</span>
              <input
                className={`${fieldClass} font-mono`}
                autoComplete="off"
                placeholder="Optional"
                value={initialAdminXUserId}
                onChange={(ev) => setInitialAdminXUserId(ev.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--xf-text-300)]">Platform role on user</span>
              <select
                className={fieldClass}
                value={initialAdminPlatformRole}
                onChange={(ev) =>
                  setInitialAdminPlatformRole(ev.target.value as "advisor" | "operator" | "viewer")
                }
              >
                <option value="operator">operator</option>
                <option value="advisor">advisor</option>
                <option value="viewer">viewer</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={setAsDefaultSessionTenant}
                onChange={(ev) => setSetAsDefaultSessionTenant(ev.target.checked)}
              />
              Set as default session tenant for this user
            </label>
          </fieldset>

          <details className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-surface-800)_40%,transparent)] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--xf-text-100)]">
              4 · Workspace limits (optional)
            </summary>
            <div className="mt-4 flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Partial JSON → core_tenants.workspaceLimits</span>
                <textarea
                  className={`${fieldClass} min-h-[11rem] font-mono text-xs leading-relaxed`}
                  spellCheck={false}
                  placeholder={WORKSPACE_LIMITS_JSON_PLACEHOLDER}
                  value={workspaceLimitsJson}
                  onChange={(ev) => setWorkspaceLimitsJson(ev.target.value)}
                />
              </label>
              <p className="status-text text-xs">
                Same keys as tenant-spec YAML: userChatLimit, userXoptionsLimit, tenantPortfolioLimit,
                portfolioAccountLimit, chatHistoryMax, maxUsersPerTenant, userChatHourlyLimit (0 = no hourly cap),
                changePersonaEnabled. Empty = defaults applied on upsert; per-plan overrides use the Workspace limits
                page after create.
              </p>
            </div>
          </details>

          <details className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-surface-800)_40%,transparent)] p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-[var(--xf-text-100)]">
              5 · Preferences
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Default shell theme</span>
                <select
                  className={fieldClass}
                  value={xfUiTheme}
                  onChange={(ev) => setXfUiTheme(ev.target.value as "" | "light" | "dark" | "system")}
                >
                  <option value="">— omit (user / OS default until set)</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                  <option value="system">system</option>
                </select>
                <span className="status-text text-xs">Maps to tenantPreferences.xf_ui_theme.</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Accent preset (optional)</span>
                <select
                  className={fieldClass}
                  value={xfBrandPalette}
                  onChange={(ev) => setXfBrandPalette(ev.target.value as "" | XfBrandPaletteId)}
                >
                  <option value="">— none</option>
                  {XF_BRAND_PALETTE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {XF_BRAND_PALETTE_LABELS[id]}
                    </option>
                  ))}
                </select>
                <span className="status-text text-xs">Advanced: xf_brand_palette for future token packs.</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={bootstrapDefaultPortfolioWatchlist}
                  type="checkbox"
                  onChange={(ev) => setBootstrapDefaultPortfolioWatchlist(ev.target.checked)}
                />
                Bootstrap default portfolio/watchlist on first approved access
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">App-user route visibility overrides (optional JSON)</span>
                <textarea
                  className={`${fieldClass} min-h-[8rem] font-mono text-xs leading-relaxed`}
                  spellCheck={false}
                  placeholder={ROUTE_OVERRIDES_JSON_PLACEHOLDER}
                  value={routeOverridesJson}
                  onChange={(ev) => setRouteOverridesJson(ev.target.value)}
                />
                <span className="status-text text-xs">
                  Route id -&gt; boolean (from admin platform route catalog), e.g. disable watchlist for this tenant.
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Default landing path by role (optional JSON)</span>
                <textarea
                  className={`${fieldClass} min-h-[8rem] font-mono text-xs leading-relaxed`}
                  spellCheck={false}
                  placeholder={DEFAULT_LANDING_JSON_PLACEHOLDER}
                  value={defaultLandingJson}
                  onChange={(ev) => setDefaultLandingJson(ev.target.value)}
                />
                <span className="status-text text-xs">
                  Role -&gt; path map. Paths must be visible for that role after route overrides.
                </span>
              </label>
            </div>
          </details>

          <button
            type="button"
            className="cta self-start"
            disabled={busy || !slug.trim() || !name.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Working…" : "Create / update tenant"}
          </button>
        </div>

        <aside
          aria-label="Branding preview"
          className="rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[var(--xf-surface-800)] p-4 shadow-[var(--xf-shadow-card)] lg:sticky lg:top-4"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--xf-text-400)]">Live preview</p>
          <div
            className="rounded-lg border p-4"
            style={{
              borderColor: `color-mix(in srgb, ${hexForColorInput(accentHex)} 35%, rgba(255,255,255,0.12))`
            }}
          >
            <div className="mb-3 flex items-center gap-3 border-b border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pb-3">
              {resolvedLogoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-md object-contain"
                  src={resolvedLogoPreview}
                />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold text-[var(--xf-bg-900)]"
                  style={{ backgroundColor: hexForColorInput(accentHex) }}
                >
                  aTx
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold text-[var(--xf-text-100)]">{previewName}</div>
                {previewTagline ? (
                  <div className="truncate text-xs text-[var(--xf-text-400)]">{previewTagline}</div>
                ) : (
                  <div className="text-xs text-[var(--xf-text-500)]">Tagline appears here</div>
                )}
              </div>
            </div>
            <button
              className="w-full rounded-md py-2 text-sm font-semibold text-[var(--xf-bg-900)]"
              style={{ backgroundColor: hexForColorInput(accentHex) }}
              type="button"
            >
              Sample action
            </button>
          </div>
        </aside>
      </div>

      {status ? (
        <p className="status-text text-sm text-[var(--xf-gain-green)]" role="status">
          {status}
        </p>
      ) : null}
      {lastOk ? (
        <p className="text-sm">
          <Link
            className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
            href={`/admin/tenant-register/${encodeURIComponent(lastOk.tenantId)}/workspace-limits`}
          >
            Open workspace limits for this tenant →
          </Link>
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--xf-warning-400)]" role="alert">
          {error}
        </p>
      ) : null}
      {lastOk ? (
        <pre
          className="max-h-64 overflow-auto rounded p-3 font-mono text-xs leading-relaxed"
          style={{
            background: "var(--xf-surface-800)",
            color: "var(--xf-text-200)"
          }}
        >
          {JSON.stringify(lastOk, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
