"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import { TenantAdminAssignPanel } from "@/app/admin/ui/tenant-admin-assign-panel";
import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";
import { XF_BRAND_PALETTE_IDS, XF_BRAND_PALETTE_LABELS, type XfBrandPaletteId } from "@/lib/tenant-branding-palette";

type WorkspaceLimitsPayload = {
  data: {
    tenantId: string;
    slug: string;
    name: string;
    tenantPreferences: Record<string, unknown>;
  };
};

function hexForColorInput(hex: string): string {
  const t = hex.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) {
    return t.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(t)) {
    const m = t.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (m) {
      return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase();
    }
  }
  return DEFAULT_TENANT_ACCENT_HEX;
}

export function EditTenantConsole() {
  const params = useParams();
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [accentHex, setAccentHex] = useState(DEFAULT_TENANT_ACCENT_HEX);
  const [xfBrandPalette, setXfBrandPalette] = useState<"" | XfBrandPaletteId>("");
  const [xfUiTheme, setXfUiTheme] = useState<"" | "light" | "dark" | "system">("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasTenantAdmin, setHasTenantAdmin] = useState(false);

  const fieldClass =
    "rounded border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[var(--xf-surface-800)] px-3 py-2 text-sm text-[var(--xf-text-100)]";

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoadError("Missing tenant id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/workspace-limits`);
      const payload = await parseJson<WorkspaceLimitsPayload>(res);
      const tp = payload.data.tenantPreferences ?? {};
      setSlug(payload.data.slug);
      setName(payload.data.name);
      let nextAccent = DEFAULT_TENANT_ACCENT_HEX;
      try {
        if (tp.xf_accent_color != null && String(tp.xf_accent_color).trim()) {
          nextAccent = normalizeXfAccentColor(tp.xf_accent_color);
        }
      } catch {
        nextAccent = DEFAULT_TENANT_ACCENT_HEX;
      }
      setAccentHex(nextAccent);
      const pal = tp.xf_brand_palette;
      if (typeof pal === "string" && (XF_BRAND_PALETTE_IDS as readonly string[]).includes(pal)) {
        setXfBrandPalette(pal as XfBrandPaletteId);
      } else {
        setXfBrandPalette("");
      }
      const th = tp.xf_ui_theme;
      if (th === "light" || th === "dark" || th === "system") {
        setXfUiTheme(th);
      } else {
        setXfUiTheme("");
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewAccent = useMemo(() => {
    try {
      return normalizeXfAccentColor(accentHex);
    } catch {
      return DEFAULT_TENANT_ACCENT_HEX;
    }
  }, [accentHex]);

  const save = useCallback(async () => {
    if (!tenantId) {
      return;
    }
    if (!hasTenantAdmin) {
      setError("Assign a tenant admin before saving.");
      return;
    }
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      let normalizedAccent: string;
      try {
        normalizedAccent = normalizeXfAccentColor(accentHex);
      } catch {
        setError("Accent color must be a valid hex value (#rgb or #rrggbb).");
        return;
      }
      const tenantPreferences: Record<string, unknown> = {
        xf_accent_color: normalizedAccent
      };
      if (xfBrandPalette) {
        tenantPreferences.xf_brand_palette = xfBrandPalette;
      }
      if (xfUiTheme) {
        tenantPreferences.xf_ui_theme = xfUiTheme;
      }

      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/workspace-limits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantPreferences })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }
      setStatus("Saved tenant branding.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [tenantId, accentHex, xfBrandPalette, xfUiTheme, hasTenantAdmin, load]);

  if (!tenantId) {
    return <p className="status-text text-sm">Invalid route.</p>;
  }

  if (loading) {
    return <p className="status-text text-sm">Loading tenant…</p>;
  }

  if (loadError) {
    return (
      <div className="stack-gap">
        <p className="text-sm text-red-400">{loadError}</p>
        <button type="button" className="cta cta-secondary text-sm" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="panel stack-gap">
      <div className="panel-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Edit tenant branding</h2>
          <p className="status-text text-sm">
            <code className="font-mono text-xs">{tenantId}</code>
            {slug ? (
              <>
                {" "}
                · <span className="font-mono">{slug}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="cta cta-secondary text-sm"
            href={`/admin/tenant-register/${encodeURIComponent(tenantId)}/workspace-limits`}
          >
            Workspace limits
          </Link>
          <Link className="cta cta-secondary text-sm" href="/admin/tenant-register">
            ← Tenant register
          </Link>
        </div>
      </div>

      <p className="text-sm font-semibold text-[var(--xf-text-100)]">{name || "—"}</p>

      <TenantAdminAssignPanel tenantId={tenantId} onHasTenantAdminChange={setHasTenantAdmin} />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Accent color</span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                aria-label="Accent color"
                className="h-10 w-14 cursor-pointer rounded border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-transparent"
                type="color"
                value={hexForColorInput(accentHex)}
                onChange={(ev) => setAccentHex(ev.target.value)}
              />
              <input
                className={`${fieldClass} font-mono max-w-[10rem]`}
                autoComplete="off"
                value={accentHex}
                onChange={(ev) => setAccentHex(ev.target.value)}
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Brand palette</span>
            <select
              className={fieldClass}
              value={xfBrandPalette}
              onChange={(ev) => setXfBrandPalette(ev.target.value as "" | XfBrandPaletteId)}
            >
              <option value="">— Unchanged / inherit —</option>
              {XF_BRAND_PALETTE_IDS.map((id) => (
                <option key={id} value={id}>
                  {XF_BRAND_PALETTE_LABELS[id]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Default shell theme</span>
            <select
              className={fieldClass}
              value={xfUiTheme}
              onChange={(ev) => setXfUiTheme(ev.target.value as "" | "light" | "dark" | "system")}
            >
              <option value="">— Leave as stored —</option>
              <option value="light">Light (soft)</option>
              <option value="dark">Deep</option>
              <option value="system">System</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cta"
              disabled={busy || !hasTenantAdmin}
              title={hasTenantAdmin ? undefined : "Assign a tenant admin first"}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
          {status ? <p className="status-text text-sm text-[var(--xf-gain-green)]">{status}</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <div
          className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] p-4"
          style={{ background: "color-mix(in srgb, var(--xf-surface-800) 92%, transparent)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--xf-text-400)]">Preview</p>
          <div
            className="mt-3 h-16 w-full rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)]"
            style={{ backgroundColor: previewAccent }}
          />
          <p className="mt-2 font-mono text-xs text-[var(--xf-text-300)]">{previewAccent}</p>
        </div>
      </div>
    </section>
  );
}
