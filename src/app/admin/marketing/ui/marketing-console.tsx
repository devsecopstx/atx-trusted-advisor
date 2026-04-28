"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import type { MarketingPlatform, MarketingTaskConfig } from "@/modules/marketing/types";

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
  scheduleCron: string;
  scheduleRRule: string;
  scheduleDescription: string;
  templateId: string;
  customContent: string;
  destinationUrl: string;
  platforms: MarketingPlatform[];
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
  utmContent: string;
  utmTerm: string;
};

const DEFAULT_DRAFT: EditDraft = {
  name: "",
  enabled: true,
  scheduleCron: "0 13 * * 1-5",
  scheduleRRule: "",
  scheduleDescription: "Weekdays at 8:00 AM CT",
  templateId: "",
  customContent: "",
  destinationUrl: "https://atx.fintech-advisor.ai",
  platforms: ["x"],
  utmSource: "x",
  utmCampaign: "weekly-pulse",
  utmMedium: "owned-social",
  utmContent: "",
  utmTerm: ""
};

type TabKey = "overview" | "schedules" | "templates" | "history";

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
    setEditingId(schedule._id);
    setActiveTab("overview");
    setDraft({
      id: schedule._id,
      name: schedule.name,
      enabled: schedule.enabled,
      scheduleCron: schedule.scheduleCron ?? "",
      scheduleRRule: schedule.scheduleRRule ?? "",
      scheduleDescription: schedule.scheduleDescription ?? "",
      templateId: schedule.config.templateId ?? "",
      customContent: schedule.config.customContent ?? "",
      destinationUrl: schedule.config.destinationUrl ?? "https://atx.fintech-advisor.ai",
      platforms: schedule.config.platforms ?? ["x"],
      utmSource: schedule.config.utmParams.utm_source,
      utmCampaign: schedule.config.utmParams.utm_campaign,
      utmMedium: schedule.config.utmParams.utm_medium ?? "",
      utmContent: schedule.config.utmParams.utm_content ?? "",
      utmTerm: schedule.config.utmParams.utm_term ?? ""
    });
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="tool-row" role="tablist" aria-label="Marketing tabs" style={{ gap: "0.4rem" }}>
          {(["overview", "schedules", "templates", "history"] as TabKey[]).map((tab) => (
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
            <h3>{editingId ? "Edit scheduled post" : "New scheduled post"}</h3>
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
            <div className="tool-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              <input
                className="crud-input text-sm"
                placeholder="Cron"
                value={draft.scheduleCron}
                onChange={(event) => setDraft((current) => ({ ...current, scheduleCron: event.target.value }))}
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
              <button type="button" className="tiny-button" onClick={() => void generatePreview()} disabled={loading}>
                Preview with xChat
              </button>
              <button type="button" className="tiny-button" onClick={resetDraft} disabled={loading}>
                Reset
              </button>
            </div>
            {preview ? (
              <div className="surface-card xf-widget section-card stack-gap" style={{ marginTop: "0.6rem" }}>
                <p className="status-text">
                  xChat persona: {preview.personaName} · model: {preview.model}
                </p>
                <p className="status-text">Final URL: {preview.finalUrl}</p>
                <pre className="output-cell" style={{ whiteSpace: "pre-wrap" }}>
                  {preview.postText}
                </pre>
              </div>
            ) : null}
            <p className="status-text">
              Every published post automatically appends: Educational conversations only. Not personalized investment advice. https://atx.fintech-advisor.ai
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
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Platforms</th>
                <th>Estimated engagement</th>
                <th>Sample</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template._id}>
                  <td>{template.name}</td>
                  <td>{template.platforms.join(", ")}</td>
                  <td>{template.estimatedEngagement ?? "—"}</td>
                  <td className="output-cell">{template.contentTemplate}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
