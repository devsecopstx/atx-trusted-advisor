"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import type {
    SerializedEmailTemplate,
    SerializedPortfolioEmailPreference
} from "@/modules/email-templates/serialize";
import {
    EMAIL_TEMPLATE_SLUGS,
    type EmailDigestCadence,
    type EmailTemplateSlug
} from "@/modules/email-templates/types";

type Resolved = {
  subject: string;
  body: string;
  cadence: EmailDigestCadence;
  enabled: boolean;
  sources: {
    subject: "portfolio_override" | "template";
    body: "portfolio_override" | "template";
    cadence: "portfolio_override" | "template";
  };
};

type TemplateRow = {
  slug: EmailTemplateSlug;
  effective: Resolved | null;
  template: SerializedEmailTemplate | null;
};

type PreferencesPayload = {
  data: {
    portfolioId: string;
    tenantId: string;
    preferences: SerializedPortfolioEmailPreference[];
    templates: TemplateRow[];
  };
};

type Draft = {
  enabled: boolean;
  cadenceOverride: EmailDigestCadence | "";
  subjectOverride: string;
  bodyOverride: string;
};

const EMPTY_DRAFT: Draft = {
  enabled: false,
  cadenceOverride: "",
  subjectOverride: "",
  bodyOverride: ""
};

function buildDraft(pref: SerializedPortfolioEmailPreference | undefined): Draft {
  if (!pref) {
    return { ...EMPTY_DRAFT };
  }
  return {
    enabled: pref.enabled,
    cadenceOverride: pref.cadenceOverride ?? "",
    subjectOverride: pref.subjectOverride ?? "",
    bodyOverride: pref.bodyOverride ?? ""
  };
}

export function AdminPortfolioEmailPreferences({ portfolioId }: { portfolioId: string }) {
  const base = `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/email-preferences`;
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [preferences, setPreferences] = useState<SerializedPortfolioEmailPreference[]>([]);
  const [drafts, setDrafts] = useState<Record<EmailTemplateSlug, Draft>>(() =>
    Object.fromEntries(EMAIL_TEMPLATE_SLUGS.map((s) => [s, { ...EMPTY_DRAFT }])) as Record<
      EmailTemplateSlug,
      Draft
    >
  );
  const [status, setStatus] = useState("Loading…");
  const [busy, setBusy] = useState<EmailTemplateSlug | null>(null);

  const refresh = useCallback(async () => {
    setStatus("Loading…");
    try {
      const res = await parseJson<PreferencesPayload>(await fetch(base, { cache: "no-store" }));
      setTemplates(res.data.templates);
      setPreferences(res.data.preferences);
      const next = { ...drafts };
      for (const slug of EMAIL_TEMPLATE_SLUGS) {
        next[slug] = buildDraft(res.data.preferences.find((p) => p.templateSlug === slug));
      }
      setDrafts(next);
      setStatus(`Loaded ${res.data.preferences.length} preference row(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function updateDraft(slug: EmailTemplateSlug, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));
  }

  async function save(slug: EmailTemplateSlug) {
    setBusy(slug);
    setStatus(`Saving ${slug}…`);
    try {
      const draft = drafts[slug];
      const payload: Record<string, unknown> = {
        templateSlug: slug,
        enabled: draft.enabled,
        cadenceOverride: draft.cadenceOverride === "" ? null : draft.cadenceOverride,
        subjectOverride: draft.subjectOverride.trim().length === 0 ? null : draft.subjectOverride,
        bodyOverride: draft.bodyOverride.trim().length === 0 ? null : draft.bodyOverride
      };
      await parseJson(
        await fetch(base, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );
      await refresh();
      setStatus(`Saved ${slug}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="admin-card" style={{ display: "grid", gap: "1.25rem" }}>
      <header className="admin-card__head">
        <h2>Per-template preferences</h2>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => void refresh()}
          disabled={busy !== null}
        >
          <RefreshIcon className="admin-btn__icon" /> Refresh
        </button>
      </header>
      <p className="admin-status" aria-live="polite">{status}</p>

      {EMAIL_TEMPLATE_SLUGS.map((slug) => {
        const t = templates.find((x) => x.slug === slug);
        const pref = preferences.find((p) => p.templateSlug === slug);
        const draft = drafts[slug];
        const effective = t?.effective ?? null;
        const template = t?.template ?? null;
        const sources = effective?.sources;
        const isOverriddenSubject = sources?.subject === "portfolio_override";
        const isOverriddenBody = sources?.body === "portfolio_override";
        const isOverriddenCadence = sources?.cadence === "portfolio_override";

        return (
          <details key={slug} open style={{ borderTop: "1px solid rgba(148,163,184,0.15)", paddingTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              <code className="font-mono text-xs">{slug}</code>{" "}
              <span style={{ color: "#94a3b8" }}>
                · {template ? `template scope=${template.tenantId ? "tenant" : "global"}` : "no template at any scope"}
                {pref ? ` · pref ${pref.enabled ? "enabled" : "disabled"}` : " · no pref row"}
              </span>
            </summary>

            {!template ? (
              <p className="admin-status" style={{ marginTop: 8 }}>
                No active template found at tenant or global scope. Create one at{" "}
                <code className="font-mono text-xs">/admin/email-templates</code> first.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
                <label className="admin-field" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => updateDraft(slug, { enabled: event.target.checked })}
                  />
                  <span>Enabled (digest fires for this portfolio)</span>
                </label>

                <label className="admin-field">
                  <span>
                    Cadence override{" "}
                    <span style={{ color: isOverriddenCadence ? "#39ff14" : "#94a3b8" }}>
                      · effective: {effective?.cadence ?? template.defaultCadence}
                    </span>
                  </span>
                  <select
                    value={draft.cadenceOverride}
                    onChange={(event) =>
                      updateDraft(slug, {
                        cadenceOverride: event.target.value as EmailDigestCadence | ""
                      })
                    }
                  >
                    <option value="">— use template default ({template.defaultCadence}) —</option>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                  </select>
                </label>

                <label className="admin-field">
                  <span>
                    Subject override{" "}
                    <span style={{ color: isOverriddenSubject ? "#39ff14" : "#94a3b8" }}>
                      · effective source: {sources?.subject ?? "template"}
                    </span>
                  </span>
                  <input
                    value={draft.subjectOverride}
                    onChange={(event) => updateDraft(slug, { subjectOverride: event.target.value })}
                    placeholder={template.subject}
                  />
                </label>

                <label className="admin-field">
                  <span>
                    Body override (Markdown + Mustache){" "}
                    <span style={{ color: isOverriddenBody ? "#39ff14" : "#94a3b8" }}>
                      · effective source: {sources?.body ?? "template"}
                    </span>
                  </span>
                  <textarea
                    value={draft.bodyOverride}
                    onChange={(event) => updateDraft(slug, { bodyOverride: event.target.value })}
                    placeholder={template.body}
                    rows={10}
                    spellCheck={false}
                    style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}
                  />
                </label>

                <div>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    onClick={() => void save(slug)}
                    disabled={busy === slug}
                  >
                    <SaveIcon className="admin-btn__icon" /> Save preferences
                  </button>
                </div>
              </div>
            )}
          </details>
        );
      })}
    </section>
  );
}
