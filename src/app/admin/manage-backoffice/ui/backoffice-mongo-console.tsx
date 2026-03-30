"use client";

import { FormEvent, useCallback, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import {
    SUBSCRIPTION_PLAN_SELECT_OPTIONS,
    type SubscriptionPlan
} from "@/lib/subscription-plan";

type LookupBy = "email" | "id";

type SerializedUser = {
  _id?: string;
  email: string;
  roles: string[];
  subscriptionPlan: SubscriptionPlan;
  status: string;
  xaiCollectionId?: string;
  xaiCollectionName?: string;
  xAccount?: {
    xUserId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    linkedAt: string;
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

const ROLE_OPTIONS = ["global_admin", "advisor", "operator", "viewer"] as const;

export function BackofficeMongoConsole() {
  const [status, setStatus] = useState("Ready");
  const [lookupBy, setLookupBy] = useState<LookupBy>("email");
  const [lookupValue, setLookupValue] = useState("");
  const [snapshot, setSnapshot] = useState<SerializedUser | null>(null);
  const [patchUserId, setPatchUserId] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | "">("");
  const [accountStatus, setAccountStatus] = useState<"active" | "suspended" | "">("");
  const [rolesSelected, setRolesSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [xDisplayName, setXDisplayName] = useState("");
  const [xUsername, setXUsername] = useState("");
  const [xAvatarUrl, setXAvatarUrl] = useState("");
  const [xaiCollectionId, setXaiCollectionId] = useState("");
  const [xaiCollectionName, setXaiCollectionName] = useState("");
  const [includeRolesInPatch, setIncludeRolesInPatch] = useState(false);

  const applySnapshotToForm = useCallback((u: SerializedUser) => {
    setPatchUserId(u._id ?? "");
    setSubscriptionPlan("");
    setAccountStatus("");
    setRolesSelected(new Set(u.roles ?? []));
    setEmail("");
    setXDisplayName("");
    setXUsername("");
    setXAvatarUrl("");
    setXaiCollectionId("");
    setXaiCollectionName("");
    setIncludeRolesInPatch(false);
  }, []);

  const runLookup = async () => {
    const value = lookupValue.trim();
    if (!value) {
      setStatus("Enter an email or user id.");
      return;
    }
    setStatus("Looking up…");
    try {
      const res = await parseJson<{ data: SerializedUser | null; found: boolean }>(
        await fetch("/api/admin/backoffice/core-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "lookup", by: lookupBy, value })
        })
      );
      setSnapshot(res.data);
      if (res.found && res.data) {
        applySnapshotToForm(res.data);
        setStatus(`Found ${res.data.email}`);
      } else {
        setStatus("No user found.");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Lookup failed");
    }
  };

  const submitPatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userId = patchUserId.trim();
    if (!userId) {
      setStatus("User id is required for patch.");
      return;
    }
    const body: Record<string, unknown> = { op: "patch", userId };
    if (subscriptionPlan) {
      body.subscriptionPlan = subscriptionPlan;
    }
    if (accountStatus) {
      body.status = accountStatus;
    }
    if (includeRolesInPatch) {
      if (rolesSelected.size === 0) {
        setStatus("Select at least one role when “Update roles” is checked.");
        return;
      }
      body.roles = [...rolesSelected];
    }
    if (email.trim()) {
      body.email = email.trim().toLowerCase();
    }
    if (xDisplayName !== "") {
      body.xAccountDisplayName = xDisplayName;
    }
    if (xUsername.trim()) {
      body.xAccountUsername = xUsername.trim();
    }
    if (xAvatarUrl.trim()) {
      body.xAccountAvatarUrl = xAvatarUrl.trim();
    }
    if (xaiCollectionId !== "") {
      body.xaiCollectionId = xaiCollectionId.trim() || null;
    }
    if (xaiCollectionName !== "") {
      body.xaiCollectionName = xaiCollectionName.trim() || null;
    }

    const keys = Object.keys(body).filter((k) => !["op", "userId"].includes(k));
    if (keys.length === 0) {
      setStatus("Select at least one field to change.");
      return;
    }

    setStatus("Applying patch…");
    try {
      const res = await parseJson<{ data: SerializedUser }>(
        await fetch("/api/admin/backoffice/core-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      );
      setSnapshot(res.data);
      applySnapshotToForm(res.data);
      setStatus("Patch applied — audit logged.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Patch failed");
    }
  };

  function toggleRole(role: string) {
    setRolesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }

  return (
    <div className="stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3>Compliance notice</h3>
        <p className="muted-copy text-sm">
          This is not a raw Mongo shell. Operations are limited to <code>core_users</code> lookup and
          allowlisted field updates. Every lookup and patch is written to the audit trail. Only{" "}
          <strong>global_admin</strong> can use this surface.
        </p>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Lookup</h3>
        <div className="stack-form">
          <label className="field-label">
            <span>Match by</span>
            <select
              aria-label="Lookup by email or id"
              onChange={(e) => setLookupBy(e.target.value as LookupBy)}
              value={lookupBy}
            >
              <option value="email">Email</option>
              <option value="id">User id (24-char hex)</option>
            </select>
          </label>
          <input
            aria-label="Lookup value"
            onChange={(e) => setLookupValue(e.target.value)}
            placeholder={lookupBy === "email" ? "user@example.com" : "507f1f77bcf86cd799439011"}
            type="text"
            value={lookupValue}
          />
          <button className="cta cta-secondary" onClick={() => void runLookup()} type="button">
            Run lookup
          </button>
        </div>
        {snapshot ? (
          <pre className="mt-4 max-h-80 overflow-auto rounded border border-[var(--xf-surface-600)] bg-[var(--xf-surface-900)] p-3 font-mono text-xs text-[var(--xf-text-muted)]">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        ) : null}
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Patch user (plan & profile)</h3>
        <form className="stack-form" onSubmit={(e) => void submitPatch(e)}>
          <label className="field-label">
            <span>User id</span>
            <input
              onChange={(e) => setPatchUserId(e.target.value)}
              placeholder="24-char ObjectId hex"
              required
              type="text"
              value={patchUserId}
            />
          </label>
          <label className="field-label">
            <span>Subscription plan</span>
            <select
              aria-label="Subscription plan"
              onChange={(e) => setSubscriptionPlan(e.target.value as SubscriptionPlan | "")}
              value={subscriptionPlan}
            >
              <option value="">— no change —</option>
              {SUBSCRIPTION_PLAN_SELECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Account status</span>
            <select
              aria-label="Account status"
              onChange={(e) => setAccountStatus(e.target.value as typeof accountStatus)}
              value={accountStatus}
            >
              <option value="">— no change —</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={includeRolesInPatch}
              onChange={(e) => setIncludeRolesInPatch(e.target.checked)}
              type="checkbox"
            />
            Update roles (unchecked = leave Mongo roles unchanged)
          </label>
          <fieldset className="stack-gap border-0 p-0">
            <legend className="field-label mb-1">Roles</legend>
            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map((role) => (
                <label className="flex items-center gap-2 text-sm" key={role}>
                  <input
                    checked={rolesSelected.has(role)}
                    disabled={!includeRolesInPatch}
                    onChange={() => toggleRole(role)}
                    type="checkbox"
                  />
                  {role}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field-label">
            <span>New email (optional)</span>
            <input
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Leave blank to keep current (see JSON above)"
              type="email"
              value={email}
            />
          </label>
          <p className="muted-copy text-xs">
          X profile and xAI collection fields are not pre-filled — copy from the JSON snapshot above when you need to
          change them (avoids accidental no-op writes).
        </p>
          <label className="field-label">
            <span>X display name</span>
            <input
              onChange={(e) => setXDisplayName(e.target.value)}
              placeholder="Optional — empty skips; use clear in repo if needed"
              type="text"
              value={xDisplayName}
            />
          </label>
          <label className="field-label">
            <span>X username</span>
            <input
              onChange={(e) => setXUsername(e.target.value)}
              placeholder="Optional"
              type="text"
              value={xUsername}
            />
          </label>
          <label className="field-label">
            <span>X avatar URL</span>
            <input
              onChange={(e) => setXAvatarUrl(e.target.value)}
              placeholder="Optional https URL"
              type="url"
              value={xAvatarUrl}
            />
          </label>
          <label className="field-label">
            <span>xAI collection id</span>
            <input
              onChange={(e) => setXaiCollectionId(e.target.value)}
              placeholder="Clear field + apply sends null to unset"
              type="text"
              value={xaiCollectionId}
            />
          </label>
          <label className="field-label">
            <span>xAI collection name</span>
            <input
              onChange={(e) => setXaiCollectionName(e.target.value)}
              type="text"
              value={xaiCollectionName}
            />
          </label>
          <button className="cta cta-primary" type="submit">
            Apply patch
          </button>
        </form>
      </article>

      <p className="status-text">{status}</p>
    </div>
  );
}
