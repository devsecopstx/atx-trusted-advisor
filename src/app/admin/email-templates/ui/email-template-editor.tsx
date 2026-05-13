"use client";

import { useCallback, useEffect, useState } from "react";

import { SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import type { SerializedEmailTemplate } from "@/modules/email-templates/serialize";
import type { EmailDigestCadence, EmailTemplateSlug } from "@/modules/email-templates/types";

type Props = {
  slug: EmailTemplateSlug;
  scope: "global" | "tenant";
};

const BASE = "/api/admin/email-templates";

export function AdminEmailTemplateEditor({ slug, scope }: Props) {
  const [row, setRow] = useState<SerializedEmailTemplate | null>(null);
  const [version, setVersion] = useState("1.0");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [defaultCadence, setDefaultCadence] = useState<EmailDigestCadence>("weekly");
  const [status, setStatus] = useState("Loading…");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setStatus("Loading…");
    try {
      const res = await parseJson<{ data: SerializedEmailTemplate }>(
        await fetch(`${BASE}/${slug}?scope=${scope}`, { cache: "no-store" })
      );
      setRow(res.data);
      setVersion(res.data.version);
      setSubject(res.data.subject);
      setBody(res.data.body);
      setActive(res.data.active);
      setDefaultCadence(res.data.defaultCadence);
      setCreating(false);
      setStatus(`Loaded — ${res.data.version} · scope=${scope}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load";
      if (message.toLowerCase().includes("not found")) {
        setRow(null);
        setCreating(true);
        setStatus("No row at this scope yet — fill in fields and Save to create.");
      } else {
        setStatus(message);
      }
    }
  }, [slug, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setStatus(creating ? "Creating…" : "Saving…");
    try {
      if (creating) {
        const res = await parseJson<{ data: SerializedEmailTemplate }>(
          await fetch(BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug,
              version,
              tenantId: scope === "global" ? null : undefined,
              subject,
              body,
              active,
              defaultCadence
            })
          })
        );
        setRow(res.data);
        setCreating(false);
        setStatus(`Created · ${new Date(res.data.updatedAt).toLocaleTimeString()}`);
        return;
      }
      const res = await parseJson<{ data: SerializedEmailTemplate }>(
        await fetch(`${BASE}/${slug}?scope=${scope}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version, subject, body, active, defaultCadence })
        })
      );
      setRow(res.data);
      setStatus(`Saved · ${new Date(res.data.updatedAt).toLocaleTimeString()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card" style={{ display: "grid", gap: "1rem" }}>
      <header className="admin-card__head">
        <h2>{slug}</h2>
        <span className="admin-status">{status}</span>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
        <label className="admin-field">
          <span>Version</span>
          <input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="1.0"
          />
        </label>
        <label className="admin-field">
          <span>Default cadence</span>
          <select
            value={defaultCadence}
            onChange={(event) => setDefaultCadence(event.target.value as EmailDigestCadence)}
          >
            <option value="weekly">weekly</option>
            <option value="daily">daily</option>
          </select>
        </label>
        <label className="admin-field" style={{ alignSelf: "end" }}>
          <span>Status</span>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Active (resolver picks this row)
          </label>
        </label>
      </div>

      <label className="admin-field">
        <span>Subject (Mustache vars allowed; no Markdown)</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="{{portfolio.name}} — Weekly digest ({{period.start}} → {{period.end}})"
        />
      </label>

      <label className="admin-field">
        <span>Body (Markdown + Mustache)</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={22}
          spellCheck={false}
          style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}
        />
      </label>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => void save()}
          disabled={busy || !subject.trim() || !body.trim() || !version.trim()}
        >
          <SaveIcon className="admin-btn__icon" />
          {creating ? "Create" : "Save changes"}
        </button>
        {!creating && row?.updatedAt ? (
          <span className="admin-status">
            Last updated <time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleString()}</time>
          </span>
        ) : null}
      </div>
    </section>
  );
}
