"use client";

import Link from "next/link";
import { FormEvent, useCallback, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type AuditEvent = {
  _id?: string;
  entityType:
    | "xpersona"
    | "access_request"
    | "core_user"
    | "deploy_note_config"
    | "admin_delivery_channel"
    | "admin_portfolio"
    | "xchat_session"
    | "core_scanner";
  entityId: string;
  action: string;
  actor: {
    userId: string;
    email?: string;
    username?: string;
  };
  details?: Record<string, unknown>;
  createdAt: string;
};

type Filters = {
  entityType: "" | AuditEvent["entityType"];
  entityId: string;
  action: string;
  actor: string;
  from: string;
  to: string;
  limit: string;
};

const DEFAULT_FILTERS: Filters = {
  entityType: "",
  entityId: "",
  action: "",
  actor: "",
  from: "",
  to: "",
  limit: "200"
};

export function AuditConsole() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [status, setStatus] = useState("Ready - set filters and load traces");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.entityType) {
      params.set("entityType", filters.entityType);
    }
    if (filters.entityId.trim()) {
      params.set("entityId", filters.entityId.trim());
    }
    if (filters.action.trim()) {
      params.set("action", filters.action.trim());
    }
    if (filters.actor.trim()) {
      params.set("actor", filters.actor.trim());
    }
    if (filters.from.trim()) {
      params.set("from", new Date(filters.from).toISOString());
    }
    if (filters.to.trim()) {
      params.set("to", new Date(filters.to).toISOString());
    }
    if (filters.limit.trim()) {
      params.set("limit", filters.limit.trim());
    }
    return params.toString();
  }, [filters]);

  const refreshAuditEvents = useCallback(async () => {
    setStatus("Loading audit events...");
    try {
      const path = queryString ? `/api/admin/audit?${queryString}` : "/api/admin/audit";
      const payload = await parseJson<{ data: AuditEvent[] }>(await fetch(path));
      setEvents(payload.data);
      setStatus(`Loaded ${payload.data.length} events`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load audit events");
    }
  }, [queryString]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAuditEvents();
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <Link className="cta cta-secondary" href="/admin">
          Back to admin functions
        </Link>
        <button className="cta cta-secondary" onClick={() => void refreshAuditEvents()} type="button">
          Refresh audit
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Filters</h3>
        <form className="stack-form" onSubmit={onSubmit}>
          <select
            onChange={(event) => updateFilter("entityType", event.target.value as Filters["entityType"])}
            value={filters.entityType}
          >
            <option value="">all entity types</option>
            <option value="xpersona">xpersona</option>
            <option value="access_request">access_request</option>
            <option value="core_user">core_user</option>
            <option value="deploy_note_config">deploy_note_config</option>
            <option value="admin_delivery_channel">admin_delivery_channel</option>
            <option value="admin_portfolio">admin_portfolio</option>
            <option value="xchat_session">xchat_session</option>
            <option value="core_scanner">core_scanner</option>
          </select>
          <input
            onChange={(event) => updateFilter("entityId", event.target.value)}
            placeholder="entity id"
            value={filters.entityId}
          />
          <input
            onChange={(event) => updateFilter("action", event.target.value)}
            placeholder="action (e.g. updated, approved)"
            value={filters.action}
          />
          <input
            onChange={(event) => updateFilter("actor", event.target.value)}
            placeholder="actor (user id, email, username)"
            value={filters.actor}
          />
          <input
            onChange={(event) => updateFilter("from", event.target.value)}
            type="datetime-local"
            value={filters.from}
          />
          <input
            onChange={(event) => updateFilter("to", event.target.value)}
            type="datetime-local"
            value={filters.to}
          />
          <input
            min={1}
            onChange={(event) => updateFilter("limit", event.target.value)}
            step={1}
            type="number"
            value={filters.limit}
          />
          <button className="cta cta-primary" type="submit">
            Apply filters
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Audit Events</h3>
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event._id ?? `${event.entityType}-${event.entityId}-${event.createdAt}`}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>
                    {event.entityType}
                    <br />
                    <small>{event.entityId}</small>
                  </td>
                  <td>{event.action}</td>
                  <td>{event.actor.email ?? event.actor.username ?? event.actor.userId}</td>
                  <td>
                    <pre className="chat-response">
                      {event.details ? JSON.stringify(event.details, null, 2) : "{}"}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
