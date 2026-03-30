"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { IconEditButton } from "@/app/ui/icon-edit-control";
import { ACCESS_REQUEST_PLAN_OPTIONS } from "@/lib/access-request-plans";
import type { SubscriptionPlan } from "@/lib/subscription-plan";
import { formatUserFacingIdentityLabel } from "@/lib/x-identity-email";

type AccessRequestStatus = "new" | "triaged" | "pending" | "approved" | "rejected" | "expired";

type AccessRequest = {
  _id?: string;
  userId: string;
  requestedRole: "global_admin" | "advisor" | "operator" | "viewer";
  requestedPlan: SubscriptionPlan;
  reason: string;
  status: AccessRequestStatus;
  requestedAt: string;
  triagedAt?: string;
  triagedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  expiredAt?: string;
  policyViolations?: Array<{ code: string; message: string }>;
  user?: {
    userId: string;
    email?: string;
    xUserId?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    lastLoginAt?: string;
    lastLoginIp?: string;
    lastLoginCountry?: string;
    lastLoginUserAgent?: string;
  };
  reviewedByUser?: {
    userId: string;
    email?: string;
    xUserId?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  latestAuditEvent?: {
    action: string;
    createdAt: string;
    actor: { userId: string; email?: string; username?: string };
  } | null;
};

type AccessRequestFilter = AccessRequestStatus | "all" | "open";

const STATUS_STEPS: AccessRequestStatus[] = ["new", "triaged", "pending", "approved"];
const TERMINAL_STATUSES: AccessRequestStatus[] = ["approved", "rejected", "expired"];
const SLA_DAYS = 7;

const STATUS_COLOR: Record<AccessRequestStatus, string> = {
  new: "status-warn",
  triaged: "status-ready",
  pending: "status-warn",
  approved: "status-live",
  rejected: "status-error",
  expired: "status-ready"
};

function formatDateTime(iso: string | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatLoginLocation(user: AccessRequest["user"]): string {
  if (!user) {
    return "—";
  }
  const parts: string[] = [];
  if (user.lastLoginCountry) {
    parts.push(user.lastLoginCountry);
  }
  if (user.lastLoginIp) {
    parts.push(user.lastLoginIp);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function daysUntilExpiry(requestedAt: string): number {
  const requested = new Date(requestedAt);
  const expiry = new Date(requested);
  expiry.setDate(expiry.getDate() + SLA_DAYS);
  const remaining = expiry.getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
}

function StatusStepIndicator({ current }: { current: AccessRequestStatus }) {
  if (current === "rejected" || current === "expired") {
    return (
      <div className="ar-step-indicator">
        <span className={`ar-step ar-step-terminal ${STATUS_COLOR[current]}`}>
          {current}
        </span>
      </div>
    );
  }

  return (
    <div className="ar-step-indicator">
      {STATUS_STEPS.map((step, i) => {
        const currentIdx = STATUS_STEPS.indexOf(current);
        const isDone = i <= currentIdx;
        const isCurrent = step === current;
        return (
          <span key={step}>
            {i > 0 ? <span className="ar-step-sep" /> : null}
            <span
              className={`ar-step${isDone ? " ar-step-done" : ""}${isCurrent ? " ar-step-current" : ""}`}
            >
              {step}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function AccessRequestsConsole() {
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [status, setStatus] = useState("Ready - tap refresh");
  const [statusFilter, setStatusFilter] = useState<AccessRequestFilter>("open");
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({});
  const [planEdits, setPlanEdits] = useState<Record<string, AccessRequest["requestedPlan"]>>({});

  const refreshAccessRequests = useCallback(async () => {
    setStatus("Loading requests...");
    try {
      const payload = await parseJson<{ data: AccessRequest[] }>(
        await fetch(`/api/admin/access-requests?status=${encodeURIComponent(statusFilter)}`, {
          cache: "no-store"
        })
      );
      setAccessRequests(payload.data);
      setEmailEdits((previous) => {
        const next = { ...previous };
        for (const item of payload.data) {
          next[item.userId] = previous[item.userId] ?? item.user?.email ?? "";
        }
        return next;
      });
      setPlanEdits((previous) => {
        const next = { ...previous };
        for (const item of payload.data) {
          if (!item._id) continue;
          next[item._id] = previous[item._id] ?? item.requestedPlan ?? "basic";
        }
        return next;
      });
      setStatus("Synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to refresh requests");
    }
  }, [statusFilter]);

  async function createAccessRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const userId = String(formData.get("userId") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!userId && !email) { setStatus("Provide either email or user id."); return; }
    if (userId && email) { setStatus("Choose one identifier only."); return; }
    setStatus("Creating access request...");
    try {
      await parseJson(
        await fetch("/api/admin/access-requests", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId || undefined,
            email: email || undefined,
            requestedRole: String(formData.get("requestedRole") ?? ""),
            requestedPlan: String(formData.get("requestedPlan") ?? "basic"),
            reason: String(formData.get("reason") ?? "")
          })
        })
      );
      event.currentTarget.reset();
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create request");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshAccessRequests(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshAccessRequests]);

  async function updateUserEmail(userId: string) {
    const email = emailEdits[userId]?.trim().toLowerCase() ?? "";
    if (!email) { setStatus("Email is required."); return; }
    setStatus("Updating user email...");
    try {
      await parseJson(await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      }));
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update email");
    }
  }

  async function reviewRequest(requestId: string, statusValue: "approved" | "rejected") {
    setStatus(`${statusValue === "approved" ? "Approving" : "Rejecting"}...`);
    try {
      await parseJson(await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue })
      }));
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update request");
    }
  }

  async function updateRequestPlan(requestId: string) {
    setStatus("Updating plan...");
    try {
      await parseJson(await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedPlan: planEdits[requestId] ?? "basic" })
      }));
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update plan");
    }
  }

  async function deleteRequest(requestId: string) {
    setStatus("Deleting...");
    try {
      await parseJson(await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, { method: "DELETE" }));
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  const isActionable = (s: AccessRequestStatus) => !TERMINAL_STATUSES.includes(s);

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <select
          aria-label="Filter access requests"
          onChange={(e) => setStatusFilter(e.target.value as AccessRequestFilter)}
          value={statusFilter}
        >
          <option value="open">open (new / triaged / pending)</option>
          <option value="all">all statuses</option>
          <option value="new">new only</option>
          <option value="triaged">triaged</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="expired">expired</option>
        </select>
        <button className="cta cta-secondary" onClick={() => void refreshAccessRequests()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>New Access Request</h3>
        <form className="stack-form" onSubmit={createAccessRequest}>
          <input name="email" placeholder="user email (preferred)" type="email" />
          <input name="userId" placeholder="user id (optional)" />
          <select name="requestedRole" defaultValue="operator">
            <option value="global_admin">global_admin (elevated)</option>
            <option value="advisor">advisor</option>
            <option value="operator">operator</option>
            <option value="viewer">viewer</option>
          </select>
          <select defaultValue="basic" name="requestedPlan">
            {ACCESS_REQUEST_PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea name="reason" placeholder="reason" required rows={3} />
          <button className="cta cta-primary" type="submit">
            <AddIcon className="crud-icon" /> Add request
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Requests ({statusFilter}) — {accessRequests.length}</h3>
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Access / sign-in</th>
                <th>Role / Plan</th>
                <th>Status</th>
                <th>SLA</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accessRequests.map((item) => {
                const days = daysUntilExpiry(item.requestedAt);
                const slaUrgent = days <= 2 && isActionable(item.status);
                const primaryLabel = formatUserFacingIdentityLabel(item.user, item.userId);
                const avatarLetter =
                  primaryLabel.replace(/^@/, "").trim().slice(0, 1).toUpperCase() || "?";
                return (
                  <tr key={item._id ?? `${item.userId}-${item.requestedAt}`}>
                    <td>
                      <div className="user-summary">
                        {item.user?.avatarUrl ? (
                          <Image
                            alt={`${item.user?.displayName ?? primaryLabel} avatar`}
                            className="user-avatar" height={32} src={item.user.avatarUrl} width={32}
                          />
                        ) : (
                          <span className="user-avatar user-avatar-fallback">
                            {avatarLetter}
                          </span>
                        )}
                        <div className="user-summary-copy">
                          <strong>{primaryLabel}</strong>
                          <span>{item.user?.displayName ?? ""}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <small className="font-mono text-xs leading-relaxed">
                        <div>
                          <span className="value-neutral">Request </span>
                          {formatDateTime(item.requestedAt)}
                        </div>
                        <div>
                          <span className="value-neutral">Last sign-in </span>
                          {formatDateTime(item.user?.lastLoginAt)}
                        </div>
                        <div>
                          <span className="value-neutral">Location </span>
                          {formatLoginLocation(item.user)}
                        </div>
                        {item.latestAuditEvent ? (
                          <div>
                            <span className="value-neutral">Request log </span>
                            {item.latestAuditEvent.action} ·{" "}
                            {formatDateTime(item.latestAuditEvent.createdAt)}
                          </div>
                        ) : null}
                      </small>
                    </td>
                    <td>
                      <span className="status-badge">{item.requestedRole}</span>
                      <br />
                      <select
                        disabled={!item._id || !isActionable(item.status)}
                        onChange={(e) => {
                          if (!item._id) return;
                          setPlanEdits((p) => ({ ...p, [item._id as string]: e.target.value as AccessRequest["requestedPlan"] }));
                        }}
                        value={item._id ? (planEdits[item._id] ?? item.requestedPlan) : "basic"}
                      >
                        {ACCESS_REQUEST_PLAN_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <StatusStepIndicator current={item.status} />
                      {item.policyViolations && item.policyViolations.length > 0 ? (
                        <small className="status-text status-error" style={{ display: "block", marginTop: "0.25rem" }}>
                          {item.policyViolations.map((v) => v.message).join("; ")}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {isActionable(item.status) ? (
                        <span className={slaUrgent ? "value-loss" : "value-neutral"}>
                          {days}d left
                        </span>
                      ) : (
                        <span className="value-neutral">—</span>
                      )}
                    </td>
                    <td><small>{item.reason}</small></td>
                    <td>
                      <div className="tool-row">
                        <IconEditButton
                          label="Edit user email"
                          variant="tiny"
                          onClick={() => void updateUserEmail(item.userId)}
                        />
                        {isActionable(item.status) && item._id ? (
                          <>
                            <IconEditButton
                              label="Edit request plan"
                              variant="tiny"
                              onClick={() => item._id && void updateRequestPlan(item._id)}
                            />
                            <button className="tiny-button" onClick={() => item._id && void reviewRequest(item._id, "approved")} type="button">
                              Approve
                            </button>
                            <button className="tiny-button" onClick={() => item._id && void reviewRequest(item._id, "rejected")} type="button">
                              Reject
                            </button>
                          </>
                        ) : null}
                        {item._id ? (
                          <button className="tiny-button" onClick={() => item._id && void deleteRequest(item._id)} type="button">
                            <DeleteIcon className="crud-icon" /> Del
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
