"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, EditIcon, RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { IconEditButton } from "@/app/ui/icon-edit-control";
import {
    normalizeSubscriptionPlan,
    SUBSCRIPTION_PLAN_SELECT_OPTIONS,
    type SubscriptionPlan
} from "@/lib/subscription-plan";

type BrokerSettings = {
  provider: "alpaca" | "interactive-brokers" | "paper";
  accountRef: string;
  enabled: boolean;
};

type PortfolioSettings = {
  riskProfile: "conservative" | "balanced" | "growth";
  investmentStrategy: "growth" | "income" | "balanced" | "aggressive";
  baseCurrency: "USD" | "EUR" | "GBP";
  rebalanceFrequencyDays: number;
};

type AccountSettings = {
  accountStatus: "active" | "suspended";
  maxConcurrentSessions: number;
  timezone: string;
};

type NotificationDefaults = {
  email: boolean;
  push: boolean;
  sms: boolean;
  digestHourUTC: number;
};

type UserAdminSettingsPayload = {
  assignedPersonaId?: string;
  finraLicenseUploadUrl?: string;
  broker: BrokerSettings;
  portfolio: PortfolioSettings;
  account: AccountSettings;
  notificationDefaults: NotificationDefaults;
  updatedAt?: string;
};

type LinkedCollection = {
  collectionId: string;
  collectionName?: string;
  source: "atxfinance_default" | "user_bootstrap" | "assigned_persona";
};

type UserSettingsResponse = {
  data: UserAdminSettingsPayload;
  metadata?: {
    linkedCollections?: LinkedCollection[];
  };
};

type PersonaOption = {
  id: string;
  name: string;
  status: string;
};

type ApprovedUser = {
  userId: string;
  name: string;
  email: string;
  subscriptionPlan: SubscriptionPlan;
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
  subscriptionPlan: SubscriptionPlan;
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

const DEFAULT_SETTINGS: UserAdminSettingsPayload = {
  assignedPersonaId: "",
  finraLicenseUploadUrl: "",
  broker: { provider: "paper", accountRef: "paper-main", enabled: true },
  portfolio: {
    riskProfile: "balanced",
    investmentStrategy: "balanced",
    baseCurrency: "USD",
    rebalanceFrequencyDays: 14
  },
  account: { accountStatus: "active", maxConcurrentSessions: 2, timezone: "America/New_York" },
  notificationDefaults: { email: true, push: true, sms: false, digestHourUTC: 13 }
};

export function UserSettingsConsole() {
  const [status, setStatus] = useState("Ready");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({});
  const [planEdits, setPlanEdits] = useState<Record<string, ApprovedUser["subscriptionPlan"]>>({});
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<ApprovedUser["subscriptionPlan"]>("basic");

  const [settingsForm, setSettingsForm] = useState<UserAdminSettingsPayload>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLastSaved, setSettingsLastSaved] = useState<string | null>(null);
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([]);
  const [personaByUserId, setPersonaByUserId] = useState<Record<string, string>>({});
  const [linkedCollectionsByUserId, setLinkedCollectionsByUserId] = useState<
    Record<string, LinkedCollection[]>
  >({});

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
          next[user.userId] = previous[user.userId] ?? user.subscriptionPlan ?? "basic";
        }
        return next;
      });
      const settingsEntries = await Promise.all(
        normalizedUsers.map(async (user) => {
          try {
            const settingsPayload = await parseJson<UserSettingsResponse>(
              await fetch(`/api/admin/users/${encodeURIComponent(user.userId)}/settings`)
            );
            return {
              userId: user.userId,
              assignedPersonaId: settingsPayload.data.assignedPersonaId ?? "",
              linkedCollections: settingsPayload.metadata?.linkedCollections ?? ([] as LinkedCollection[])
            };
          } catch {
            return {
              userId: user.userId,
              assignedPersonaId: "",
              linkedCollections: [] as LinkedCollection[]
            };
          }
        })
      );
      setPersonaByUserId(Object.fromEntries(settingsEntries.map((entry) => [entry.userId, entry.assignedPersonaId])));
      const linkedCollectionsRecord: Record<string, LinkedCollection[]> = {};
      for (const entry of settingsEntries) {
        linkedCollectionsRecord[entry.userId] = entry.linkedCollections;
      }
      setLinkedCollectionsByUserId(linkedCollectionsRecord);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load approved users");
    }
  }, []);

  const refreshPersonaOptions = useCallback(async () => {
    try {
      const payload = await parseJson<{
        data: Array<{
          _id?: string;
          name: string;
          status?: string;
        }>;
      }>(await fetch("/api/personas"));
      const options = payload.data
        .filter((persona): persona is { _id: string; name: string; status?: string } => Boolean(persona._id))
        .map((persona) => ({
          id: persona._id,
          name: persona.name,
          status: persona.status ?? "draft"
        }))
        .sort((a, b) => {
          const rank = (s: string) => (s === "published" ? 0 : s === "draft" ? 1 : 2);
          const byStatus = rank(a.status) - rank(b.status);
          if (byStatus !== 0) {
            return byStatus;
          }
          return a.name.localeCompare(b.name);
        });
      setPersonaOptions(options);
    } catch {
      setPersonaOptions([]);
    }
  }, []);

  const loadUserSettings = useCallback(async (userId: string) => {
    setSettingsLoading(true);
    setSettingsLastSaved(null);
    try {
      const payload = await parseJson<UserSettingsResponse>(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/settings`)
      );
      setSettingsForm({
        assignedPersonaId: payload.data.assignedPersonaId ?? "",
        finraLicenseUploadUrl: payload.data.finraLicenseUploadUrl ?? "",
        broker: payload.data.broker,
        portfolio: {
          ...payload.data.portfolio,
          investmentStrategy: payload.data.portfolio.investmentStrategy ?? "balanced"
        },
        account: payload.data.account,
        notificationDefaults: payload.data.notificationDefaults
      });
      if (payload.data.updatedAt) {
        setSettingsLastSaved(payload.data.updatedAt);
      }
      setLinkedCollectionsByUserId((previous) => ({
        ...previous,
        [userId]: payload.metadata?.linkedCollections ?? []
      }));
      setStatus(`Settings loaded for ${userId}`);
    } catch {
      setSettingsForm(DEFAULT_SETTINGS);
      setLinkedCollectionsByUserId((previous) => ({
        ...previous,
        [userId]: []
      }));
      setStatus("No existing settings — defaults loaded");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  async function saveUserEdits(userId: string) {
    const email = emailEdits[userId]?.trim().toLowerCase() ?? "";
    if (!email) {
      setStatus("Email is required.");
      return;
    }
    const subscriptionPlan = planEdits[userId] ?? "basic";
    setStatus(`Saving user changes for ${userId}...`);
    try {
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, subscriptionPlan })
        })
      );
      const settingsPayload = await parseJson<{ data: UserAdminSettingsPayload }>(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/settings`)
      ).catch(() => ({ data: DEFAULT_SETTINGS }));
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settingsPayload.data,
            assignedPersonaId: personaByUserId[userId] ?? ""
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
          body: JSON.stringify({ email, subscriptionPlan: newUserPlan, status: "active" })
        })
      );
      setNewUserEmail("");
      setNewUserPlan("basic");
      await refreshApprovedUsers();
      setStatus("User created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create user");
    }
  }

  async function deleteUser(userId: string) {
    const row = approvedUsers.find((u) => u.userId === userId);
    const email = row?.email ?? userId;
    const message = [
      "Permanent delete — this cannot be undone.",
      "",
      `User: ${email}`,
      "",
      "All data tied to this user id and email will be removed, including:",
      "• Portfolios, accounts, positions, watchlists, and portfolio-scoped rows",
      "• Tenant memberships and admin user settings",
      "• Access requests, xChat logs, app recommendations, options strategy prefs",
      "• Feature usage meters, strategy jobs, login audit rows for this user/email",
      "• Bootstrap profile and access-request bootstrap trace tasks for this email",
      "",
      "Type DELETE to confirm."
    ].join("\n");
    const typed = window.prompt(message);
    if (typed !== "DELETE") {
      setStatus(typed === null ? "Delete cancelled" : "Delete cancelled — type DELETE exactly to confirm");
      return;
    }
    setStatus("Deleting user and associated data...");
    try {
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" })
      );
      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setEditingUserId(null);
      }
      await refreshApprovedUsers();
      setStatus("User deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete user");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) {
      setStatus("Select a user first");
      return;
    }
    setStatus(`Saving settings for ${selectedUserId}...`);
    try {
      const payload = await parseJson<{ data: { updatedAt: string } }>(
        await fetch(`/api/admin/users/${encodeURIComponent(selectedUserId)}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsForm)
        })
      );
      setSettingsLastSaved(payload.data.updatedAt);
      setStatus("Settings saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save settings");
    }
  }

  function selectUser(userId: string) {
    setSelectedUserId(userId);
    void loadUserSettings(userId);
  }

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshApprovedUsers();
      void refreshPersonaOptions();
    }, 0);
    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [refreshApprovedUsers, refreshPersonaOptions]);

  const selectedLinkedCollections = selectedUserId
    ? linkedCollectionsByUserId[selectedUserId] ?? []
    : [];

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" onClick={() => void refreshApprovedUsers()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh users
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
            onChange={(event) => setNewUserPlan(event.target.value as ApprovedUser["subscriptionPlan"])}
            value={newUserPlan}
            aria-label="Subscription plan for new user"
          >
            {SUBSCRIPTION_PLAN_SELECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
                <th>Plan</th>
                <th>xPersona</th>
                <th>Audit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvedUsers.map((user) => (
                <tr key={user.userId} className={selectedUserId === user.userId ? "row-selected" : ""}>
                  <td>{user.name}</td>
                  <td>
                    <input
                      disabled={editingUserId !== user.userId}
                      onChange={(event) =>
                        setEmailEdits((previous) => ({ ...previous, [user.userId]: event.target.value }))
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
                        setPlanEdits((previous) => ({
                          ...previous,
                          [user.userId]: event.target.value as ApprovedUser["subscriptionPlan"]
                        }))
                      }
                      value={planEdits[user.userId] ?? user.subscriptionPlan}
                      aria-label={`Subscription plan for ${user.email}`}
                    >
                      {SUBSCRIPTION_PLAN_SELECT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      disabled={editingUserId !== user.userId}
                      onChange={(event) =>
                        setPersonaByUserId((previous) => ({
                          ...previous,
                          [user.userId]: event.target.value
                        }))
                      }
                      value={personaByUserId[user.userId] ?? ""}
                    >
                      <option value="">(default persona)</option>
                      {personaOptions.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.name}
                        </option>
                      ))}
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
                      <button className="tiny-button" onClick={() => selectUser(user.userId)} type="button">
                        <EditIcon className="crud-icon" /> Select
                      </button>
                      <IconEditButton
                        label="Edit user"
                        variant="tiny"
                        onClick={() => {
                          selectUser(user.userId);
                          setEditingUserId(user.userId);
                        }}
                      />
                      <button
                        className="tiny-button"
                        disabled={editingUserId !== user.userId || selectedUserId !== user.userId}
                        onClick={() => void saveUserEdits(user.userId)}
                        type="button"
                      >
                        <SaveIcon className="crud-icon" /> Save
                      </button>
                      <button className="tiny-button" onClick={() => void deleteUser(user.userId)} type="button">
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

      {selectedUserId ? (
        <article className="surface-card xf-widget section-card">
          <h3>
            Settings for {approvedUsers.find((u) => u.userId === selectedUserId)?.name ?? selectedUserId}
          </h3>
          {settingsLastSaved ? (
            <p className="status-text">Last saved: {new Date(settingsLastSaved).toLocaleString()}</p>
          ) : null}
          {settingsLoading ? (
            <p className="status-text">Loading settings...</p>
          ) : (
            <form className="stack-form" onSubmit={saveSettings}>
              <fieldset>
                <legend>xPersona Assignment</legend>
                <div className="tool-row">
                  <label className="min-w-0 grow basis-48">
                    Assigned Persona
                    <select
                      onChange={(e) =>
                        setSettingsForm((s) => ({
                          ...s,
                          assignedPersonaId: e.target.value
                        }))
                      }
                      value={settingsForm.assignedPersonaId ?? ""}
                    >
                      <option value="">(default persona)</option>
                      {personaOptions.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.status === "published"
                            ? persona.name
                            : `${persona.name} (${persona.status})`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="cta cta-secondary"
                    onClick={() => void refreshPersonaOptions()}
                    type="button"
                  >
                    <RefreshIcon className="crud-icon" /> Refresh personas
                  </button>
                </div>
                <p className="status-text">
                  List includes draft and published personas from Admin Hub → Manage xPersonas. Assigning a persona requires a{" "}
                  <strong>published</strong> xPersona — publish first, then assign.
                </p>
                <p className="status-text">This controls xChat ask persona routing for the selected user.</p>
                <div className="status-text" role="status">
                  Linked user collections:
                  {selectedLinkedCollections.length === 0 ? (
                    " none"
                  ) : (
                    <ul>
                      {selectedLinkedCollections.map((collection) => (
                        <li key={`${collection.source}:${collection.collectionId}`}>
                          {collection.collectionName
                            ? `${collection.collectionName} (${collection.collectionId})`
                            : collection.collectionId}{" "}
                          [{collection.source}]
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </fieldset>

              <fieldset>
                <legend>Compliance Placeholder</legend>
                <label>
                  FINRA License Upload URL
                  <input
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        finraLicenseUploadUrl: e.target.value
                      }))
                    }
                    placeholder="https://compliance.example.com/uploads/finra-license.pdf"
                    value={settingsForm.finraLicenseUploadUrl ?? ""}
                  />
                </label>
                <p className="status-text">
                  Placeholder for investor compliance workflow. Upload handling is a later integration.
                </p>
              </fieldset>

              <fieldset>
                <legend>Broker</legend>
                <label>
                  Provider
                  <select
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        broker: { ...s.broker, provider: e.target.value as BrokerSettings["provider"] }
                      }))
                    }
                    value={settingsForm.broker.provider}
                  >
                    <option value="paper">paper</option>
                    <option value="alpaca">alpaca</option>
                    <option value="interactive-brokers">interactive-brokers</option>
                  </select>
                </label>
                <label>
                  Account Ref
                  <input
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, broker: { ...s.broker, accountRef: e.target.value } }))
                    }
                    required
                    value={settingsForm.broker.accountRef}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    checked={settingsForm.broker.enabled}
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, broker: { ...s.broker, enabled: e.target.checked } }))
                    }
                    type="checkbox"
                  />
                  Enabled
                </label>
              </fieldset>

              <fieldset>
                <legend>Portfolio</legend>
                <label>
                  Risk Profile
                  <select
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        portfolio: {
                          ...s.portfolio,
                          riskProfile: e.target.value as PortfolioSettings["riskProfile"]
                        }
                      }))
                    }
                    value={settingsForm.portfolio.riskProfile}
                  >
                    <option value="conservative">conservative</option>
                    <option value="balanced">balanced</option>
                    <option value="growth">growth</option>
                  </select>
                </label>
                <label>
                  Investment strategy
                  <select
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        portfolio: {
                          ...s.portfolio,
                          investmentStrategy: e.target.value as PortfolioSettings["investmentStrategy"]
                        }
                      }))
                    }
                    value={settingsForm.portfolio.investmentStrategy}
                  >
                    <option value="growth">growth</option>
                    <option value="income">income</option>
                    <option value="balanced">balanced</option>
                    <option value="aggressive">aggressive</option>
                  </select>
                </label>
                <label>
                  Base Currency
                  <select
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        portfolio: {
                          ...s.portfolio,
                          baseCurrency: e.target.value as PortfolioSettings["baseCurrency"]
                        }
                      }))
                    }
                    value={settingsForm.portfolio.baseCurrency}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </label>
                <label>
                  Rebalance Frequency (days)
                  <input
                    min={1}
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        portfolio: { ...s.portfolio, rebalanceFrequencyDays: Number(e.target.value) || 14 }
                      }))
                    }
                    type="number"
                    value={settingsForm.portfolio.rebalanceFrequencyDays}
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>Account</legend>
                <label>
                  Status
                  <select
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        account: {
                          ...s.account,
                          accountStatus: e.target.value as AccountSettings["accountStatus"]
                        }
                      }))
                    }
                    value={settingsForm.account.accountStatus}
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                  </select>
                </label>
                <label>
                  Max Concurrent Sessions
                  <input
                    max={20}
                    min={1}
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        account: { ...s.account, maxConcurrentSessions: Number(e.target.value) || 2 }
                      }))
                    }
                    type="number"
                    value={settingsForm.account.maxConcurrentSessions}
                  />
                </label>
                <label>
                  Timezone
                  <input
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, account: { ...s.account, timezone: e.target.value } }))
                    }
                    required
                    value={settingsForm.account.timezone}
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>Notifications</legend>
                <label className="checkbox-label">
                  <input
                    checked={settingsForm.notificationDefaults.email}
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        notificationDefaults: { ...s.notificationDefaults, email: e.target.checked }
                      }))
                    }
                    type="checkbox"
                  />
                  Email
                </label>
                <label className="checkbox-label">
                  <input
                    checked={settingsForm.notificationDefaults.push}
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        notificationDefaults: { ...s.notificationDefaults, push: e.target.checked }
                      }))
                    }
                    type="checkbox"
                  />
                  Push
                </label>
                <label className="checkbox-label">
                  <input
                    checked={settingsForm.notificationDefaults.sms}
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        notificationDefaults: { ...s.notificationDefaults, sms: e.target.checked }
                      }))
                    }
                    type="checkbox"
                  />
                  SMS
                </label>
                <label>
                  Digest Hour (UTC)
                  <input
                    max={23}
                    min={0}
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        notificationDefaults: {
                          ...s.notificationDefaults,
                          digestHourUTC: Number(e.target.value) || 0
                        }
                      }))
                    }
                    type="number"
                    value={settingsForm.notificationDefaults.digestHourUTC}
                  />
                </label>
              </fieldset>

              <button className="cta cta-primary" type="submit">
                <SaveIcon className="crud-icon" /> Save settings
              </button>
            </form>
          )}
        </article>
      ) : (
        <article className="surface-card xf-widget section-card">
          <h3>User Admin Settings</h3>
          <p className="status-text">
            Select a user from the table above to load and edit their broker, portfolio, account, and
            notification settings.
          </p>
        </article>
      )}
    </section>
  );
}

function toApprovedUser(user: ApiUser & { _id: string }): ApprovedUser {
  return {
    userId: user._id,
    name: user.xAccount?.displayName ?? user.xAccount?.username ?? user.email,
    email: user.email,
    subscriptionPlan: normalizeSubscriptionPlan(user.subscriptionPlan),
    approvedAt: user.updatedAt,
    latestAuditEvent: user.latestAuditEvent ?? null
  };
}
