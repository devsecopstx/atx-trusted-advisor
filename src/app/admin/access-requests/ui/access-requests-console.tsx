"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";

import { parseJson } from "@/app/admin/ui/http";
import { AddIcon, DeleteIcon, EditIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";

type AccessRequest = {
  _id?: string;
  userId: string;
  requestedRole: "advisor" | "operator" | "viewer";
  requestedPlan: "free" | "pro" | "enterprise";
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  user?: {
    userId: string;
    email?: string;
    xUserId?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
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
    actor: {
      userId: string;
      email?: string;
      username?: string;
    };
  } | null;
};

type AccessRequestFilter = "pending" | "approved" | "rejected" | "all";

export function AccessRequestsConsole() {
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [status, setStatus] = useState("Ready - tap refresh");
  const [statusFilter, setStatusFilter] = useState<AccessRequestFilter>("pending");
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({});
  const [planEdits, setPlanEdits] = useState<Record<string, AccessRequest["requestedPlan"]>>({});

  const refreshAccessRequests = useCallback(async () => {
    setStatus("Loading requests...");
    try {
      const payload = await parseJson<{ data: AccessRequest[] }>(
        await fetch(`/api/admin/access-requests?status=${encodeURIComponent(statusFilter)}`)
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
          if (!item._id) {
            continue;
          }
          next[item._id] = previous[item._id] ?? item.requestedPlan ?? "free";
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

    if (!userId && !email) {
      setStatus("Provide either email or user id.");
      return;
    }
    if (userId && email) {
      setStatus("Choose one identifier only: email or user id.");
      return;
    }

    setStatus("Creating access request...");

    try {
      await parseJson(
        await fetch("/api/admin/access-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId || undefined,
            email: email || undefined,
            requestedRole: String(formData.get("requestedRole") ?? ""),
            requestedPlan: String(formData.get("requestedPlan") ?? "free"),
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
    const refreshTimer = window.setTimeout(() => {
      void refreshAccessRequests();
    }, 0);
    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [refreshAccessRequests]);

  async function updateUserEmail(userId: string) {
    const email = emailEdits[userId]?.trim().toLowerCase() ?? "";
    if (!email) {
      setStatus("Email is required to update user.");
      return;
    }
    setStatus("Updating user email...");
    try {
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        })
      );
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update email");
    }
  }

  async function reviewRequest(requestId: string, statusValue: "approved" | "rejected") {
    setStatus(`${statusValue === "approved" ? "Approving" : "Rejecting"} request...`);
    try {
      await parseJson(
        await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusValue })
        })
      );
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update request");
    }
  }

  async function updateRequestPlan(requestId: string) {
    const requestedPlan = planEdits[requestId] ?? "free";
    setStatus("Updating request plan...");
    try {
      await parseJson(
        await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestedPlan })
        })
      );
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update request plan");
    }
  }

  async function deleteRequest(requestId: string) {
    setStatus("Deleting request...");
    try {
      await parseJson(
        await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
          method: "DELETE"
        })
      );
      await refreshAccessRequests();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete request");
    }
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <select
          aria-label="Filter access requests by status"
          onChange={(event) => setStatusFilter(event.target.value as AccessRequestFilter)}
          value={statusFilter}
        >
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="all">all</option>
        </select>
        <button className="cta cta-secondary" onClick={() => void refreshAccessRequests()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh requests
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>New Access Request</h3>
        <form className="stack-form" onSubmit={createAccessRequest}>
          <input name="email" placeholder="user email (preferred)" type="email" />
          <input name="userId" placeholder="user id (optional advanced path)" />
          <select name="requestedRole" defaultValue="operator">
            <option value="advisor">advisor</option>
            <option value="operator">operator</option>
            <option value="viewer">viewer</option>
          </select>
          <select defaultValue="free" name="requestedPlan">
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="enterprise">enterprise</option>
          </select>
          <textarea name="reason" placeholder="reason" required rows={3} />
          <button className="cta cta-primary" type="submit">
            <AddIcon className="crud-icon" /> Add request
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Requests ({statusFilter})</h3>
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Audit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accessRequests.map((item) => (
                <tr key={item._id ?? `${item.userId}-${item.requestedAt}`}>
                  <td>
                    <div className="user-summary">
                      {item.user?.avatarUrl ? (
                        <Image
                          alt={`${item.user?.displayName ?? item.user?.username ?? "user"} avatar`}
                          className="user-avatar"
                          height={32}
                          src={item.user.avatarUrl}
                          width={32}
                        />
                      ) : (
                        <span className="user-avatar user-avatar-fallback">
                          {(item.user?.displayName ?? item.user?.username ?? item.userId)
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                      )}
                      <div className="user-summary-copy">
                        <strong>{item.user?.email ?? item.user?.username ?? item.userId}</strong>
                        <span>{item.user?.displayName ?? item.user?.username ?? "No display name"}</span>
                        <span>xid: {item.user?.xUserId ?? "missing"}</span>
                      </div>
                    </div>
                    <input
                      onChange={(event) =>
                        setEmailEdits((previous) => ({
                          ...previous,
                          [item.userId]: event.target.value
                        }))
                      }
                      placeholder="update user email"
                      type="email"
                      value={emailEdits[item.userId] ?? ""}
                    />
                  </td>
                  <td>{item.requestedRole}</td>
                  <td>
                    <select
                      disabled={!item._id || item.status !== "pending"}
                      onChange={(event) => {
                        const requestId = item._id;
                        if (!requestId) {
                          return;
                        }
                        setPlanEdits((previous) => ({
                          ...previous,
                          [requestId]: event.target.value as AccessRequest["requestedPlan"]
                        }));
                      }}
                      value={item._id ? (planEdits[item._id] ?? item.requestedPlan ?? "free") : "free"}
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td>{item.status}</td>
                  <td>{item.reason}</td>
                  <td>
                    {item.reviewedAt
                      ? `Reviewed by ${
                          item.reviewedByUser?.email ??
                          item.reviewedByUser?.displayName ??
                          item.reviewedByUser?.username ??
                          item.reviewedBy ??
                          "unknown"
                        } at ${new Date(item.reviewedAt).toLocaleString()}`
                      : "Not reviewed"}
                    {item.latestAuditEvent ? (
                      <>
                        <br />
                        Last change: {item.latestAuditEvent.action} by{" "}
                        {item.latestAuditEvent.actor.email ??
                          item.latestAuditEvent.actor.username ??
                          item.latestAuditEvent.actor.userId} at{" "}
                        {new Date(item.latestAuditEvent.createdAt).toLocaleString()}
                      </>
                    ) : null}
                  </td>
                  <td>
                    <div className="tool-row">
                      <button
                        className="tiny-button"
                        onClick={() => void updateUserEmail(item.userId)}
                        type="button"
                      >
                        <EditIcon className="crud-icon" /> Edit email
                      </button>
                      <button
                        className="tiny-button"
                        disabled={!item._id || item.status !== "pending"}
                        onClick={() => item._id && void updateRequestPlan(item._id)}
                        type="button"
                      >
                        <EditIcon className="crud-icon" /> Edit plan
                      </button>
                      <button
                        className="tiny-button"
                        disabled={!item._id || item.status !== "pending"}
                        onClick={() => item._id && void reviewRequest(item._id, "approved")}
                        type="button"
                      >
                        <EditIcon className="crud-icon" /> Edit approve
                      </button>
                      <button
                        className="tiny-button"
                        disabled={!item._id || item.status !== "pending"}
                        onClick={() => item._id && void reviewRequest(item._id, "rejected")}
                        type="button"
                      >
                        <EditIcon className="crud-icon" /> Edit reject
                      </button>
                      <button
                        className="tiny-button"
                        disabled={!item._id}
                        onClick={() => item._id && void deleteRequest(item._id)}
                        type="button"
                      >
                        <DeleteIcon className="crud-icon" /> Delete
                      </button>
                    </div>
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
