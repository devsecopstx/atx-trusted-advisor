"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, EditIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type UserSettingsResponse = {
  data: {
    updatedAt: string;
  };
};

type ApprovedUser = {
  userId: string;
  name: string;
  email: string;
  role: "global_admin" | "advisor" | "operator" | "viewer" | "unknown";
  subscriptionPlan: "free" | "pro" | "enterprise";
  approvedAt?: string;
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

type ApiUser = {
  _id?: string;
  email: string;
  roles: Array<"global_admin" | "advisor" | "operator" | "viewer">;
  subscriptionPlan: "free" | "pro" | "enterprise";
  status: "active" | "suspended";
  xAccount?: {
    username?: string;
    displayName?: string;
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
  createdAt: string;
  updatedAt: string;
};

type EditableRole = Exclude<ApprovedUser["role"], "unknown">;

export function UserSettingsConsole() {
  const [status, setStatus] = useState("Ready");
  const [result, setResult] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({});
  const [roleEdits, setRoleEdits] = useState<Record<string, EditableRole>>({});
  const [planEdits, setPlanEdits] = useState<Record<string, ApprovedUser["subscriptionPlan"]>>({});
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<EditableRole>("viewer");
  const [newUserPlan, setNewUserPlan] = useState<ApprovedUser["subscriptionPlan"]>("free");

  const refreshApprovedUsers = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: ApiUser[] }>(
        await fetch("/api/admin/users?limit=200")
      );
      const normalizedUsers = payload.data
        .filter((user): user is ApiUser & { _id: string } => Boolean(user._id))
        .map((user) => toApprovedUser(user));

      setApprovedUsers(normalizedUsers);
      setEmailEdits((previous) => {
        const next = { ...previous };
        for (const user of normalizedUsers) {
          next[user.userId] = previous[user.userId] ?? user.email ?? "";
        }
        return next;
      });
      setPlanEdits((previous) => {
        const next = { ...previous };
        for (const user of normalizedUsers) {
          next[user.userId] = previous[user.userId] ?? user.subscriptionPlan ?? "free";
        }
        return next;
      });
      setRoleEdits((previous) => {
        const next = { ...previous };
        for (const user of normalizedUsers) {
          if (user.role === "unknown") {
            next[user.userId] = previous[user.userId] ?? "viewer";
            continue;
          }
          next[user.userId] = previous[user.userId] ?? user.role;
        }
        return next;
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load approved users");
    }
  }, []);

  async function saveUserEdits(userId: string) {
    const email = emailEdits[userId]?.trim().toLowerCase() ?? "";
    if (!email) {
      setStatus("Email is required.");
      return;
    }
    const subscriptionPlan = planEdits[userId] ?? "free";
    const role = roleEdits[userId] ?? "viewer";
    setStatus(`Saving user changes for ${userId}...`);
    try {
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            role,
            subscriptionPlan
          })
        })
      );
      await refreshApprovedUsers();
      setEditingUserId(null);
      setStatus("User changes saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save user changes");
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = newUserEmail.trim().toLowerCase();
    if (!email) {
      setStatus("Email is required.");
      return;
    }
    setStatus("Creating user...");
    try {
      await parseJson(
        await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            role: newUserRole,
            subscriptionPlan: newUserPlan,
            status: "active"
          })
        })
      );
      setNewUserEmail("");
      setNewUserRole("viewer");
      setNewUserPlan("free");
      await refreshApprovedUsers();
      setStatus("User created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create user");
    }
  }

  async function deleteUser(userId: string) {
    setStatus("Deleting user...");
    try {
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "DELETE"
        })
      );
      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setEditingUserId(null);
        setUserIdInput("");
      }
      await refreshApprovedUsers();
      setStatus("User deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete user");
    }
  }

  async function upsertUserSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = userIdInput.trim();
    if (!userId) {
      setStatus("Missing user id");
      return;
    }

    setStatus(`Updating settings for ${userId}...`);
    try {
      const payload = await parseJson<UserSettingsResponse>(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            broker: {
              provider: "paper",
              accountRef: "paper-main",
              enabled: true
            },
            portfolio: {
              riskProfile: "balanced",
              baseCurrency: "USD",
              rebalanceFrequencyDays: 14
            },
            account: {
              accountStatus: "active",
              maxConcurrentSessions: 2,
              timezone: "America/New_York"
            },
            notificationDefaults: {
              email: true,
              push: true,
              sms: false,
              digestHourUTC: 13
            }
          })
        })
      );

      setResult(
        `Settings saved for ${userId} at ${new Date(payload.data.updatedAt).toLocaleString()}`
      );
      setStatus("User settings upserted");
      setUserIdInput("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update user settings");
    }
  }

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshApprovedUsers();
    }, 0);
    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [refreshApprovedUsers]);

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" onClick={() => void refreshApprovedUsers()} type="button">
          Refresh users
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Users</h3>
        <form className="stack-form" onSubmit={createUser}>
          <input
            onChange={(event) => setNewUserEmail(event.target.value)}
            placeholder="new user email"
            required
            type="email"
            value={newUserEmail}
          />
          <select
            onChange={(event) => setNewUserRole(event.target.value as EditableRole)}
            value={newUserRole}
          >
            <option value="global_admin">global_admin</option>
            <option value="advisor">advisor</option>
            <option value="operator">operator</option>
            <option value="viewer">viewer</option>
          </select>
          <select
            onChange={(event) => setNewUserPlan(event.target.value as ApprovedUser["subscriptionPlan"])}
            value={newUserPlan}
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="enterprise">enterprise</option>
          </select>
          <button className="cta cta-primary" type="submit">
            <AddIcon className="crud-icon" /> Add user
          </button>
        </form>
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Audit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvedUsers.map((user) => (
                <tr key={user.userId}>
                  <td>{user.name}</td>
                  <td>
                    <input
                      disabled={editingUserId !== user.userId}
                      onChange={(event) =>
                        setEmailEdits((previous) => ({
                          ...previous,
                          [user.userId]: event.target.value
                        }))
                      }
                      placeholder="update user email"
                      type="email"
                      value={emailEdits[user.userId] ?? ""}
                    />
                  </td>
                  <td>
                    <select
                      disabled={editingUserId !== user.userId}
                      onChange={(event) =>
                        setRoleEdits((previous) => ({
                          ...previous,
                          [user.userId]: event.target.value as EditableRole
                        }))
                      }
                      value={roleEdits[user.userId] ?? (user.role === "unknown" ? "viewer" : user.role)}
                    >
                      <option value="global_admin">global_admin</option>
                      <option value="advisor">advisor</option>
                      <option value="operator">operator</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </td>
                  <td>
                    <select
                      disabled={editingUserId !== user.userId}
                      onChange={(event) =>
                        setPlanEdits((previous) => ({
                          ...previous,
                          [user.userId]: event.target.value as ApprovedUser["subscriptionPlan"]
                        }))
                      }
                      value={planEdits[user.userId] ?? user.subscriptionPlan}
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td>
                    {user.latestAuditEvent
                      ? `${user.latestAuditEvent.action} by ${
                          user.latestAuditEvent.actor.email ??
                          user.latestAuditEvent.actor.username ??
                          user.latestAuditEvent.actor.userId
                        } at ${new Date(user.latestAuditEvent.createdAt).toLocaleString()}`
                      : user.approvedAt
                        ? new Date(user.approvedAt).toLocaleString()
                        : "unknown"}
                  </td>
                  <td>
                    <div className="tool-row">
                      <button
                        className="tiny-button"
                        onClick={() => {
                          setSelectedUserId(user.userId);
                          setUserIdInput(user.userId);
                        }}
                        type="button"
                      >
                        <EditIcon className="crud-icon" /> Select
                      </button>
                      <button
                        className="tiny-button"
                        onClick={() => {
                          setSelectedUserId(user.userId);
                          setEditingUserId(user.userId);
                          setUserIdInput(user.userId);
                        }}
                        type="button"
                      >
                        <EditIcon className="crud-icon" /> Edit
                      </button>
                      <button
                        className="tiny-button"
                        disabled={editingUserId !== user.userId || selectedUserId !== user.userId}
                        onClick={() => void saveUserEdits(user.userId)}
                        type="button"
                      >
                        <EditIcon className="crud-icon" /> Save
                      </button>
                      <button
                        className="tiny-button"
                        onClick={() => void deleteUser(user.userId)}
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

      <article className="surface-card xf-widget section-card">
        <h3>Upsert Default xuser</h3>
        <p className="status-text">
          Rows are read-only by default. Select a row, press <strong>Edit</strong>, then press{" "}
          <strong>Save</strong> to persist email, role, and plan changes.
        </p>
        <form className="stack-form" onSubmit={upsertUserSettings}>
          <input
            name="userId"
            onChange={(event) => setUserIdInput(event.target.value)}
            placeholder="user id"
            required
            value={userIdInput}
          />
          <button className="cta cta-primary" type="submit">
            <AddIcon className="crud-icon" /> Add xuser
          </button>
        </form>
        {result ? <p className="status-text">{result}</p> : null}
      </article>
    </section>
  );
}

function toApprovedUser(user: ApiUser & { _id: string }): ApprovedUser {
  const firstRole = user.roles[0];
  const role: ApprovedUser["role"] = firstRole ?? "unknown";
  return {
    userId: user._id,
    name: user.xAccount?.displayName ?? user.xAccount?.username ?? user.email,
    email: user.email,
    role,
    subscriptionPlan: user.subscriptionPlan ?? "free",
    approvedAt: user.updatedAt,
    latestAuditEvent: user.latestAuditEvent ?? null
  };
}
