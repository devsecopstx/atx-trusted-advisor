"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import type { MarketingPlatform, MarketingTaskConfig } from "@/modules/marketing/types";

import { MarketingXPostingConnectPanel } from "./marketing-x-posting-connect";

type MarketingTemplate = {
  _id: string;
  slug: string;
  name: string;
  platforms: MarketingPlatform[];
  contentTemplate: string;
  defaultUtm: MarketingTaskConfig["utmParams"];
  disclaimerMode: "required";
  estimatedEngagement?: "low" | "medium" | "high";
};

type TemplateDraft = {
  id?: string;
  name: string;
  platforms: MarketingPlatform[];
  contentTemplate: string;
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
  utmContent: string;
  utmTerm: string;
  estimatedEngagement: "" | "low" | "medium" | "high";
};

type MarketingSchedule = {
  _id: string;
  name: string;
  enabled: boolean;
  scheduleCron?: string;
  scheduleRRule?: string;
  scheduleDescription?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  config: MarketingTaskConfig;
};

type MarketingHistoryRow = {
  taskRunId: string;
  taskId: string;
  taskName: string;
  status: "running" | "success" | "failed";
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output: string;
};

type MarketingPreview = {
  markdown: string;
  postText: string;
  finalUrl: string;
  model: string;
  personaName: string;
};

type EditDraft = {
  id?: string;
  name: string;
  enabled: boolean;
  schedulePreset: SchedulePreset;
  scheduleCron: string;
  scheduleRRule: string;
  scheduleDescription: string;
  templateId: string;
  customContent: string;
  generationPrompt: string;
  destinationUrl: string;
  platforms: MarketingPlatform[];
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
  utmContent: string;
  utmTerm: string;
};

type SchedulePreset = "daily" | "monday" | "friday" | "custom";

const SCHEDULE_PRESET_OPTIONS: Record<
  Exclude<SchedulePreset, "custom">,
  { cron: string; scheduleDescription: string }
> = {
  daily: { cron: "0 13 * * *", scheduleDescription: "Daily at 13:00 UTC" },
  monday: { cron: "0 13 * * 1", scheduleDescription: "Every Monday at 13:00 UTC" },
  friday: { cron: "0 13 * * 5", scheduleDescription: "Every Friday at 13:00 UTC" }
};

function detectPresetFromCron(cron: string): SchedulePreset {
  const c = cron.trim();
  if (c === SCHEDULE_PRESET_OPTIONS.daily.cron) {
    return "daily";
  }
  if (c === SCHEDULE_PRESET_OPTIONS.monday.cron) {
    return "monday";
  }
  if (c === SCHEDULE_PRESET_OPTIONS.friday.cron) {
    return "friday";
  }
  return "custom";
}

const DEFAULT_DRAFT: EditDraft = {
  name: "",
  enabled: true,
  schedulePreset: "daily",
  scheduleCron: SCHEDULE_PRESET_OPTIONS.daily.cron,
  scheduleRRule: "",
  scheduleDescription: SCHEDULE_PRESET_OPTIONS.daily.scheduleDescription,
  templateId: "",
  customContent: "",
  generationPrompt: [
    "Generate post-ready markdown for social publishing.",
    "Platforms: {{platforms}}.",
    "Keep it concise and actionable.",
    "No markdown code fences.",
    "Focus on options profits: covered calls, protective puts, straddles, scanner workflows.",
    "",
    "Draft source content:",
    "{{source_content}}",
    "",
    "Destination URL:",
    "{{destination_url}}"
  ].join("\n"),
  destinationUrl: "https://atxtrustedadvisory.com",
  platforms: ["x"],
  utmSource: "x",
  utmCampaign: "weekly-pulse",
  utmMedium: "owned-social",
  utmContent: "",
  utmTerm: ""
};

type TabKey = "overview" | "schedules" | "templates" | "history" | "test-x";

function formatTs(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { timeZone: "America/Chicago", hour12: true });
}

function buildConfigFromDraft(draft: EditDraft): MarketingTaskConfig {
  return {
    templateId: draft.templateId || undefined,
    customContent: draft.customContent.trim() || undefined,
    generationPrompt: draft.generationPrompt.trim() || undefined,
    destinationUrl: draft.destinationUrl.trim(),
    platforms: draft.platforms,
    utmParams: {
      utm_source: draft.utmSource.trim(),
      utm_campaign: draft.utmCampaign.trim(),
      utm_medium: draft.utmMedium.trim() || undefined,
      utm_content: draft.utmContent.trim() || undefined,
      utm_term: draft.utmTerm.trim() || undefined
    }
  };
}

export function MarketingConsole() {
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [schedules, setSchedules] = useState<MarketingSchedule[]>([]);
  const [history, setHistory] = useState<MarketingHistoryRow[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(DEFAULT_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MarketingPreview | null>(null);
  const [previewRunning, setPreviewRunning] = useState(false);
  const [testPostRunning, setTestPostRunning] = useState(false);
  const [testPostText, setTestPostText] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>({
    name: "",
    platforms: ["x"],
    contentTemplate: "",
    utmSource: "x",
    utmCampaign: "weekly-pulse",
    utmMedium: "owned-social",
    utmContent: "",
    utmTerm: "",
    estimatedEngagement: ""
  });

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesPayload, schedulesPayload, historyPayload] = await Promise.all([
        parseJson<{ data: MarketingTemplate[] }>(await fetch("/api/admin/marketing/templates", { cache: "no-store" })),
        parseJson<{ data: MarketingSchedule[] }>(await fetch("/api/admin/marketing/schedules", { cache: "no-store" })),
        parseJson<{ data: MarketingHistoryRow[] }>(await fetch("/api/admin/marketing/history?limit=200", { cache: "no-store" }))
      ]);
      setTemplates(templatesPayload.data);
      setSchedules(schedulesPayload.data);
      setHistory(historyPayload.data);
      setStatus("Synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const stats = useMemo(() => {
    const active = schedules.filter((item) => item.enabled).length;
    const succeeded30 = history.filter((item) => item.status === "success").length;
    const failed30 = history.filter((item) => item.status === "failed").length;
    return { totalSchedules: schedules.length, active, succeeded30, failed30 };
  }, [history, schedules]);

  const resetDraft = useCallback(() => {
    setDraft(DEFAULT_DRAFT);
    setEditingId(null);
    setPreview(null);
  }, []);

  const applyTemplate = useCallback(
    (templateId: string) => {
      const selected = templates.find((item) => item._id === templateId);
      if (!selected) {
        return;
      }
      setDraft((current) => ({
        ...current,
        templateId: selected._id,
        customContent: selected.contentTemplate,
        platforms: selected.platforms,
        utmSource: selected.defaultUtm.utm_source,
        utmCampaign: selected.defaultUtm.utm_campaign,
        utmMedium: selected.defaultUtm.utm_medium ?? current.utmMedium
      }));
    },
    [templates]
  );

  async function upsertSchedule() {
    setLoading(true);
    setStatus(editingId ? "Saving schedule..." : "Creating schedule...");
    try {
      const payload = {
        name: draft.name.trim(),
        enabled: draft.enabled,
        scheduleCron: draft.scheduleCron.trim() || undefined,
        scheduleRRule: draft.scheduleRRule.trim() || undefined,
        scheduleDescription: draft.scheduleDescription.trim() || undefined,
        config: buildConfigFromDraft(draft)
      };
      if (!payload.name) {
        throw new Error("Schedule name is required");
      }
      const endpoint = editingId
        ? `/api/admin/marketing/schedules/${encodeURIComponent(editingId)}`
        : "/api/admin/marketing/schedules";
      const method = editingId ? "PATCH" : "POST";
      await parseJson(
        await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );
      setStatus(editingId ? "Schedule updated" : "Schedule created");
      resetDraft();
      await refreshAll();
      setActiveTab("schedules");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function generatePreview() {
    setPreviewRunning(true);
    setLoading(true);
    setStatus("Generating xChat markdown preview...");
    setPreview(null);
    try {
      const config = buildConfigFromDraft(draft);
      if (!draft.customContent.trim() && !draft.templateId.trim()) {
        throw new Error("Select a template or provide custom content");
      }
      const payload = {
        templateId: draft.templateId.trim() || undefined,
        customContent: draft.customContent.trim() || undefined,
        generationPrompt: draft.generationPrompt.trim() || undefined,
        destinationUrl: config.destinationUrl,
        platforms: config.platforms,
        utmParams: config.utmParams
      };
      const response = await parseJson<{ data: MarketingPreview }>(
        await fetch("/api/admin/marketing/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );
      setPreview(response.data);
      setStatus(`Preview generated via ${response.data.model}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setLoading(false);
      setPreviewRunning(false);
    }
  }

  async function runNow(id: string) {
    setLoading(true);
    setStatus("Executing post now...");
    try {
      await parseJson(
        await fetch(`/api/admin/marketing/schedules/${encodeURIComponent(id)}/run-now`, { method: "POST" })
      );
      setStatus("Run-now queued");
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Run-now failed");
    } finally {
      setLoading(false);
    }
  }

  async function testPostToX() {
    if (!preview?.postText) {
      setStatus("Generate a preview first");
      return;
    }
    setTestPostRunning(true);
    setLoading(true);
    setStatus("Posting preview output to X...");
    try {
      await parseJson(
        await fetch("/api/admin/marketing/test-post-x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postText: preview.postText })
        })
      );
      setStatus("Test post sent to X (connected OAuth account).");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Test post to X failed");
    } finally {
      setLoading(false);
      setTestPostRunning(false);
    }
  }

  async function testSimplePostToX() {
    const body = testPostText.trim();
    if (!body) {
      setStatus("Enter post text before sending test post");
      return;
    }
    setTestPostRunning(true);
    setLoading(true);
    setStatus("Posting simple test to X...");
    try {
      await parseJson(
        await fetch("/api/admin/marketing/test-post-x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postText: body })
        })
      );
      setStatus("Simple test post sent to X.");
      setTestPostText("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Simple test post to X failed");
    } finally {
      setLoading(false);
      setTestPostRunning(false);
    }
  }

  async function removeSchedule(id: string) {
    if (!window.confirm("Delete this marketing schedule?")) {
      return;
    }
    setLoading(true);
    setStatus("Deleting schedule...");
    try {
      await parseJson(
        await fetch(`/api/admin/marketing/schedules/${encodeURIComponent(id)}`, { method: "DELETE" })
      );
      setStatus("Schedule deleted");
      await refreshAll();
      if (editingId === id) {
        resetDraft();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(schedule: MarketingSchedule) {
    const cron = schedule.scheduleCron ?? "";
    setEditingId(schedule._id);
    setActiveTab("overview");
    setDraft({
      id: schedule._id,
      name: schedule.name,
      enabled: schedule.enabled,
      schedulePreset: detectPresetFromCron(cron),
      scheduleCron: cron,
      scheduleRRule: schedule.scheduleRRule ?? "",
      scheduleDescription: schedule.scheduleDescription ?? "",
      templateId: schedule.config.templateId ?? "",
      customContent: schedule.config.customContent ?? "",
      generationPrompt: schedule.config.generationPrompt ?? DEFAULT_DRAFT.generationPrompt,
      destinationUrl: schedule.config.destinationUrl ?? "https://atxtrustedadvisory.com",
      platforms: schedule.config.platforms ?? ["x"],
      utmSource: schedule.config.utmParams.utm_source,
      utmCampaign: schedule.config.utmParams.utm_campaign,
      utmMedium: schedule.config.utmParams.utm_medium ?? "",
      utmContent: schedule.config.utmParams.utm_content ?? "",
      utmTerm: schedule.config.utmParams.utm_term ?? ""
    });
  }

  function beginTemplateEdit(template: MarketingTemplate) {
    setCreatingTemplate(false);
    setEditingTemplateId(template._id);
    setTemplateDraft({
      id: template._id,
      name: template.name,
      platforms: template.platforms,
      contentTemplate: template.contentTemplate,
      utmSource: template.defaultUtm.utm_source,
      utmCampaign: template.defaultUtm.utm_campaign,
      utmMedium: template.defaultUtm.utm_medium ?? "",
      utmContent: template.defaultUtm.utm_content ?? "",
      utmTerm: template.defaultUtm.utm_term ?? "",
      estimatedEngagement: template.estimatedEngagement ?? ""
    });
  }

  function resetTemplateEdit() {
    setEditingTemplateId(null);
    setCreatingTemplate(false);
    setTemplateDraft({
      name: "",
      platforms: ["x"],
      contentTemplate: "",
      utmSource: "x",
      utmCampaign: "weekly-pulse",
      utmMedium: "owned-social",
      utmContent: "",
      utmTerm: "",
      estimatedEngagement: ""
    });
  }

  function beginTemplateCreate() {
    setCreatingTemplate(true);
    setEditingTemplateId(null);
    setTemplateDraft({
      name: "",
      platforms: ["x"],
      contentTemplate: "",
      utmSource: "x",
      utmCampaign: "weekly-pulse",
      utmMedium: "owned-social",
      utmContent: "",
      utmTerm: "",
      estimatedEngagement: ""
    });
    setActiveTab("templates");
  }

  async function saveNewTemplate() {
    setLoading(true);
    setStatus("Creating template...");
    try {
      const payload = {
        name: templateDraft.name.trim(),
        platforms: templateDraft.platforms,
        contentTemplate: templateDraft.contentTemplate.trim(),
        defaultUtm: {
          utm_source: templateDraft.utmSource.trim(),
          utm_campaign: templateDraft.utmCampaign.trim(),
          utm_medium: templateDraft.utmMedium.trim() || undefined,
          utm_content: templateDraft.utmContent.trim() || undefined,
          utm_term: templateDraft.utmTerm.trim() || undefined
        },
        estimatedEngagement:
          templateDraft.estimatedEngagement === ""
            ? undefined
            : (templateDraft.estimatedEngagement as "low" | "medium" | "high")
      };
      if (!payload.name || !payload.contentTemplate) {
        throw new Error("Template name and content are required");
      }
      await parseJson(
        await fetch("/api/admin/marketing/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );
      setStatus("Template created");
      resetTemplateEdit();
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Template create failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplateEdit() {
    if (!editingTemplateId) {
      return;
    }
    setLoading(true);
    setStatus("Saving template...");
    try {
      const payload = {
        name: templateDraft.name.trim(),
        platforms: templateDraft.platforms,
        contentTemplate: templateDraft.contentTemplate.trim(),
        defaultUtm: {
          utm_source: templateDraft.utmSource.trim(),
          utm_campaign: templateDraft.utmCampaign.trim(),
          utm_medium: templateDraft.utmMedium.trim() || undefined,
          utm_content: templateDraft.utmContent.trim() || undefined,
          utm_term: templateDraft.utmTerm.trim() || undefined
        },
        estimatedEngagement: templateDraft.estimatedEngagement || null
      };
      if (!payload.name || !payload.contentTemplate) {
        throw new Error("Template name and content are required");
      }
      await parseJson(
        await fetch(`/api/admin/marketing/templates/${encodeURIComponent(editingTemplateId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );
      setStatus("Template updated");
      resetTemplateEdit();
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Template update failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!window.confirm("Delete this marketing template?")) {
      return;
    }
    setLoading(true);
    setStatus("Deleting template...");
    try {
      await parseJson(
        await fetch(`/api/admin/marketing/templates/${encodeURIComponent(id)}`, {
          method: "DELETE"
        })
      );
      setStatus("Template deleted");
      if (editingTemplateId === id) {
        resetTemplateEdit();
      }
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Template delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel stack-gap">
      <MarketingXPostingConnectPanel returnPath="/admin/marketing" />

      <div className="tool-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="tool-row" role="tablist" aria-label="Marketing tabs" style={{ gap: "0.4rem" }}>
          {(["overview", "schedules", "templates", "history", "test-x"] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              className={`tiny-button ${activeTab === tab ? "cta cta-primary" : ""}`}
              onClick={() => setActiveTab(tab)}
              disabled={loading}
            >
              {tab}
            </button>
          ))}
        </div>
        <button type="button" className="tiny-button" onClick={() => void refreshAll()} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className="status-text">{status}</p>

      {activeTab === "overview" ? (
        <div className="stack-gap">
          <div className="surface-card xf-widget section-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(12rem,1fr))", gap: "0.75rem" }}>
            <p><strong>{stats.totalSchedules}</strong> schedules</p>
            <p><strong>{stats.active}</strong> active</p>
            <p><strong>{stats.succeeded30}</strong> successful runs</p>
            <p><strong>{stats.failed30}</strong> failed runs</p>
          </div>

          <article className="surface-card xf-widget section-card stack-form">
            <h3>{editingId ? "Edit scheduled post" : "Compose & schedule social post"}</h3>
            <p className="status-text">
              Pick or author a <strong>template</strong> as source text → optional <strong>xChat generation prompt</strong>{" "}
              produces <code className="text-xs">post_content</code> → <strong>Preview with xChat</strong> →{" "}
              <strong>Post to X now</strong> or <strong>Discard preview</strong>, then optionally{" "}
              <strong>Create schedule</strong> for automated runs (scheduled jobs use the same xChat prompt when configured).
            </p>
            <input
              className="crud-input"
              placeholder="Name"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
            <div className="tool-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <label className="status-text">Template</label>
              <select
                className="crud-input text-sm"
                value={draft.templateId}
                onChange={(event) => applyTemplate(event.target.value)}
              >
                <option value="">Custom content</option>
                {templates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="crud-input"
              rows={6}
              placeholder="Post content (supports {{date}}, {{day_name}}, {{market_pulse}})"
              value={draft.customContent}
              onChange={(event) => setDraft((current) => ({ ...current, customContent: event.target.value }))}
            />
            <p className="status-text">
              Template variables: {"{{date}}"}, {"{{day_name}}"}, {"{{market_pulse}}"}
            </p>
            <textarea
              className="crud-input"
              rows={8}
              placeholder="xChat generation prompt"
              value={draft.generationPrompt}
              onChange={(event) =>
                setDraft((current) => ({ ...current, generationPrompt: event.target.value }))
              }
            />
            <p className="status-text">
              Prompt variables: {"{{source_content}}"}, {"{{destination_url}}"}, {"{{platforms}}"}
            </p>
            <input
              className="crud-input"
              placeholder="Destination URL"
              value={draft.destinationUrl}
              onChange={(event) => setDraft((current) => ({ ...current, destinationUrl: event.target.value }))}
            />
            <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              <label>
                <input
                  type="checkbox"
                  checked={draft.platforms.includes("x")}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      platforms: event.target.checked
                        ? (Array.from(new Set<MarketingPlatform>([...current.platforms, "x"])) as MarketingPlatform[])
                        : (current.platforms.filter((platform) => platform !== "x") as MarketingPlatform[])
                    }))
                  }
                />{" "}
                X
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.platforms.includes("linkedin")}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      platforms: event.target.checked
                        ? (Array.from(new Set<MarketingPlatform>([...current.platforms, "linkedin"])) as MarketingPlatform[])
                        : (current.platforms.filter((platform) => platform !== "linkedin") as MarketingPlatform[])
                    }))
                  }
                />{" "}
                LinkedIn
              </label>
            </div>
            <div className="tool-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <label className="status-text whitespace-nowrap">Frequency</label>
              <select
                className="crud-input text-sm max-w-xs"
                value={draft.schedulePreset}
                onChange={(event) => {
                  const next = event.target.value as SchedulePreset;
                  if (next === "custom") {
                    setDraft((current) => ({ ...current, schedulePreset: "custom" }));
                    return;
                  }
                  const preset = SCHEDULE_PRESET_OPTIONS[next];
                  setDraft((current) => ({
                    ...current,
                    schedulePreset: next,
                    scheduleCron: preset.cron,
                    scheduleDescription: preset.scheduleDescription
                  }));
                }}
              >
                <option value="daily">Daily (13:00 UTC)</option>
                <option value="monday">Every Monday (13:00 UTC)</option>
                <option value="friday">Every Friday (13:00 UTC)</option>
                <option value="custom">Custom cron…</option>
              </select>
            </div>
            <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              <input
                className="crud-input text-sm font-mono"
                placeholder="Cron (advanced)"
                title="Quartz-style cron; editing switches Frequency to Custom"
                value={draft.scheduleCron}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    scheduleCron: event.target.value,
                    schedulePreset: "custom"
                  }))
                }
              />
              <input
                className="crud-input text-sm"
                placeholder="RRULE (optional)"
                value={draft.scheduleRRule}
                onChange={(event) => setDraft((current) => ({ ...current, scheduleRRule: event.target.value }))}
              />
            </div>
            <input
              className="crud-input text-sm"
              placeholder="Schedule description"
              value={draft.scheduleDescription}
              onChange={(event) => setDraft((current) => ({ ...current, scheduleDescription: event.target.value }))}
            />
            <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              <input className="crud-input text-sm" placeholder="utm_source" value={draft.utmSource} onChange={(event) => setDraft((current) => ({ ...current, utmSource: event.target.value }))} />
              <input className="crud-input text-sm" placeholder="utm_campaign" value={draft.utmCampaign} onChange={(event) => setDraft((current) => ({ ...current, utmCampaign: event.target.value }))} />
              <input className="crud-input text-sm" placeholder="utm_medium" value={draft.utmMedium} onChange={(event) => setDraft((current) => ({ ...current, utmMedium: event.target.value }))} />
            </div>
            <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              <button type="button" className="cta cta-primary" onClick={() => void upsertSchedule()} disabled={loading}>
                {editingId ? "Save schedule" : "Create schedule"}
              </button>
              <button
                type="button"
                className="tiny-button"
                onClick={() => void generatePreview()}
                disabled={loading}
              >
                {previewRunning ? "Generating preview..." : "Preview with xChat"}
              </button>
              <button
                type="button"
                className="tiny-button"
                style={{ borderColor: "var(--xf-gain-green)", color: "var(--xf-gain-green)" }}
                onClick={() => void testPostToX()}
                disabled={loading || !preview}
              >
                {testPostRunning ? "Posting to X..." : "Post to X now"}
              </button>
              <button
                type="button"
                className="tiny-button"
                onClick={() => setPreview(null)}
                disabled={loading || !preview}
              >
                Discard preview
              </button>
              <button type="button" className="tiny-button" onClick={resetDraft} disabled={loading}>
                Reset form
              </button>
            </div>
            {previewRunning ? (
              <p className="status-text" role="status" aria-live="polite">
                xChat preview job running... this can take up to ~20s depending on model/tools.
              </p>
            ) : null}
            {preview ? (
              <div className="surface-card xf-widget section-card stack-gap" style={{ marginTop: "0.6rem" }}>
                <p className="status-text">
                  xChat persona: {preview.personaName} · model: {preview.model}
                </p>
                <p className="status-text">Destination (UTM): {preview.finalUrl}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--xf-text-400)]">post_content (generated markdown)</p>
                <pre
                  style={{
                    width: "100%",
                    margin: 0,
                    padding: "0.75rem",
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    borderRadius: "0.5rem",
                    border: "1px solid var(--xf-surface-700)",
                    background: "var(--xf-surface-900)"
                  }}
                >
                  {preview.markdown}
                </pre>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--xf-text-400)]">
                  Final post text (includes URL + disclaimer — sent to X)
                </p>
                <pre
                  style={{
                    width: "100%",
                    margin: 0,
                    padding: "0.75rem",
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    borderRadius: "0.5rem",
                    border: "1px solid var(--xf-surface-700)",
                    background: "var(--xf-surface-900)"
                  }}
                >
                  {preview.postText}
                </pre>
              </div>
            ) : null}
            <p className="status-text">
              Final post text appends your destination URL with UTMs, then the compliance disclaimer (no extra link in the disclaimer line).
            </p>
          </article>
        </div>
      ) : null}

      {activeTab === "schedules" ? (
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Platforms</th>
                <th>Frequency</th>
                <th>Next run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.config.platforms.join(", ")}</td>
                  <td>{item.scheduleDescription ?? item.scheduleRRule ?? item.scheduleCron ?? "—"}</td>
                  <td>{formatTs(item.nextRunAt)}</td>
                  <td>
                    <span className={`status-badge ${item.enabled ? "status-ready" : "status-pending"}`}>
                      {item.enabled ? "active" : "paused"}
                    </span>
                  </td>
                  <td>
                    <div className="tool-row" style={{ gap: "0.3rem", flexWrap: "wrap" }}>
                      <button type="button" className="tiny-button" onClick={() => beginEdit(item)} disabled={loading}>Edit</button>
                      <button type="button" className="tiny-button" onClick={() => void runNow(item._id)} disabled={loading}>Run now</button>
                      <button
                        type="button"
                        className="tiny-button"
                        onClick={() =>
                          void updateMarketingScheduleState(item, {
                            enabled: !item.enabled
                          })
                        }
                        disabled={loading}
                      >
                        {item.enabled ? "Pause" : "Activate"}
                      </button>
                      <button type="button" className="tiny-button" onClick={() => void removeSchedule(item._id)} disabled={loading}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "templates" ? (
        <div className="stack-gap">
          <div className="tool-row" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="cta cta-primary"
              onClick={beginTemplateCreate}
              disabled={loading || creatingTemplate}
            >
              New template
            </button>
          </div>
          {creatingTemplate ? (
            <article className="surface-card xf-widget section-card stack-form">
              <h3>New template</h3>
              <p className="status-text">
                Source text is merged with the xChat generation prompt on the Marketing overview tab; save here, then
                select the template when composing a post.
              </p>
              <input
                className="crud-input"
                placeholder="Template name"
                value={templateDraft.name}
                onChange={(event) =>
                  setTemplateDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
              <textarea
                className="crud-input"
                rows={6}
                placeholder="Template content (source for xChat; supports {{date}}, {{day_name}})"
                value={templateDraft.contentTemplate}
                onChange={(event) =>
                  setTemplateDraft((current) => ({ ...current, contentTemplate: event.target.value }))
                }
              />
              <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={templateDraft.platforms.includes("x")}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        platforms: event.target.checked
                          ? (Array.from(new Set<MarketingPlatform>([...current.platforms, "x"])) as MarketingPlatform[])
                          : (current.platforms.filter((platform) => platform !== "x") as MarketingPlatform[])
                      }))
                    }
                  />{" "}
                  X
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={templateDraft.platforms.includes("linkedin")}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        platforms: event.target.checked
                          ? (Array.from(new Set<MarketingPlatform>([...current.platforms, "linkedin"])) as MarketingPlatform[])
                          : (current.platforms.filter((platform) => platform !== "linkedin") as MarketingPlatform[])
                      }))
                    }
                  />{" "}
                  LinkedIn
                </label>
              </div>
              <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <input className="crud-input text-sm" placeholder="utm_source" value={templateDraft.utmSource} onChange={(event) => setTemplateDraft((current) => ({ ...current, utmSource: event.target.value }))} />
                <input className="crud-input text-sm" placeholder="utm_campaign" value={templateDraft.utmCampaign} onChange={(event) => setTemplateDraft((current) => ({ ...current, utmCampaign: event.target.value }))} />
                <input className="crud-input text-sm" placeholder="utm_medium" value={templateDraft.utmMedium} onChange={(event) => setTemplateDraft((current) => ({ ...current, utmMedium: event.target.value }))} />
              </div>
              <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <select
                  className="crud-input text-sm"
                  value={templateDraft.estimatedEngagement}
                  onChange={(event) =>
                    setTemplateDraft((current) => ({
                      ...current,
                      estimatedEngagement: event.target.value as TemplateDraft["estimatedEngagement"]
                    }))
                  }
                >
                  <option value="">Engagement: unset</option>
                  <option value="low">Engagement: low</option>
                  <option value="medium">Engagement: medium</option>
                  <option value="high">Engagement: high</option>
                </select>
                <button type="button" className="cta cta-primary" onClick={() => void saveNewTemplate()} disabled={loading}>
                  Save new template
                </button>
                <button type="button" className="tiny-button" onClick={resetTemplateEdit} disabled={loading}>
                  Cancel
                </button>
              </div>
            </article>
          ) : null}
          {editingTemplateId ? (
            <article className="surface-card xf-widget section-card stack-form">
              <h3>Edit template</h3>
              <input
                className="crud-input"
                placeholder="Template name"
                value={templateDraft.name}
                onChange={(event) =>
                  setTemplateDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
              <textarea
                className="crud-input"
                rows={6}
                placeholder="Template content"
                value={templateDraft.contentTemplate}
                onChange={(event) =>
                  setTemplateDraft((current) => ({ ...current, contentTemplate: event.target.value }))
                }
              />
              <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={templateDraft.platforms.includes("x")}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        platforms: event.target.checked
                          ? (Array.from(new Set<MarketingPlatform>([...current.platforms, "x"])) as MarketingPlatform[])
                          : (current.platforms.filter((platform) => platform !== "x") as MarketingPlatform[])
                      }))
                    }
                  />{" "}
                  X
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={templateDraft.platforms.includes("linkedin")}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        platforms: event.target.checked
                          ? (Array.from(new Set<MarketingPlatform>([...current.platforms, "linkedin"])) as MarketingPlatform[])
                          : (current.platforms.filter((platform) => platform !== "linkedin") as MarketingPlatform[])
                      }))
                    }
                  />{" "}
                  LinkedIn
                </label>
              </div>
              <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <input className="crud-input text-sm" placeholder="utm_source" value={templateDraft.utmSource} onChange={(event) => setTemplateDraft((current) => ({ ...current, utmSource: event.target.value }))} />
                <input className="crud-input text-sm" placeholder="utm_campaign" value={templateDraft.utmCampaign} onChange={(event) => setTemplateDraft((current) => ({ ...current, utmCampaign: event.target.value }))} />
                <input className="crud-input text-sm" placeholder="utm_medium" value={templateDraft.utmMedium} onChange={(event) => setTemplateDraft((current) => ({ ...current, utmMedium: event.target.value }))} />
              </div>
              <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <select
                  className="crud-input text-sm"
                  value={templateDraft.estimatedEngagement}
                  onChange={(event) =>
                    setTemplateDraft((current) => ({
                      ...current,
                      estimatedEngagement: event.target.value as TemplateDraft["estimatedEngagement"]
                    }))
                  }
                >
                  <option value="">Engagement: unset</option>
                  <option value="low">Engagement: low</option>
                  <option value="medium">Engagement: medium</option>
                  <option value="high">Engagement: high</option>
                </select>
                <button type="button" className="cta cta-primary" onClick={() => void saveTemplateEdit()} disabled={loading}>
                  Save template
                </button>
                <button type="button" className="tiny-button" onClick={resetTemplateEdit} disabled={loading}>
                  Cancel
                </button>
              </div>
            </article>
          ) : null}
          <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Platforms</th>
                <th>Estimated engagement</th>
                <th>Sample</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template._id}>
                  <td>{template.name}</td>
                  <td>{template.platforms.join(", ")}</td>
                  <td>{template.estimatedEngagement ?? "—"}</td>
                  <td className="output-cell">{template.contentTemplate}</td>
                  <td>
                    <div className="tool-row" style={{ gap: "0.3rem", flexWrap: "wrap" }}>
                      <button type="button" className="tiny-button" onClick={() => beginTemplateEdit(template)} disabled={loading}>
                        Edit
                      </button>
                      <button type="button" className="tiny-button" onClick={() => void deleteTemplate(template._id)} disabled={loading}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Triggered by</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Output</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.taskRunId}>
                  <td>{row.taskName}</td>
                  <td>
                    <span className={`status-badge status-${row.status === "success" ? "ready" : row.status === "failed" ? "error" : "pending"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.triggeredBy}</td>
                  <td>{formatTs(row.startedAt)}</td>
                  <td>{row.durationMs ? `${row.durationMs}ms` : "—"}</td>
                  <td className="output-cell">{row.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "test-x" ? (
        <article className="surface-card xf-widget section-card stack-form">
          <h3>Test post to X</h3>
          <p className="status-text">
            Sends a test post using the account from <strong>Connect X for posting</strong> above (or legacy env refresh
            token).
          </p>
          <textarea
            className="crud-input"
            rows={8}
            placeholder="Simple test post text"
            value={testPostText}
            onChange={(event) => setTestPostText(event.target.value)}
          />
          <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="cta cta-primary"
              onClick={() => void testSimplePostToX()}
              disabled={loading || !testPostText.trim()}
            >
              {testPostRunning ? "Posting to X..." : "Post simple test to X"}
            </button>
            <button
              type="button"
              className="tiny-button"
              onClick={() => setTestPostText("")}
              disabled={loading || !testPostText}
            >
              Clear
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );

  async function updateMarketingScheduleState(
    schedule: MarketingSchedule,
    patch: { enabled: boolean }
  ): Promise<void> {
    setLoading(true);
    setStatus(patch.enabled ? "Activating schedule..." : "Pausing schedule...");
    try {
      await parseJson(
        await fetch(`/api/admin/marketing/schedules/${encodeURIComponent(schedule._id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: patch.enabled })
        })
      );
      await refreshAll();
      setStatus(patch.enabled ? "Schedule activated" : "Schedule paused");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Status update failed");
    } finally {
      setLoading(false);
    }
  }
}
