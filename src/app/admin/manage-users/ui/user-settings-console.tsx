"use client";

import { useQuery } from "@tanstack/react-query";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
    AddIcon,
    ApproveAccessIcon,
    CopyIcon,
    DeleteIcon,
    EditIcon,
    MailIcon,
    RefreshIcon,
    RejectAccessIcon,
    SaveIcon,
    SendIcon,
    SyncArrowsIcon,
    XMarkIcon
} from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { IconEditButton } from "@/app/ui/icon-edit-control";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { ACCESS_REQUEST_PLAN_OPTIONS } from "@/lib/access-request-plans";
import { type AdminAccessRequest, isAdminAccessRequestActionable } from "@/lib/admin/admin-access-request";
import {
    buildGroupedDirectoryTableEntries,
    filterAccessRequestsForDirectory,
    filterUsersForDirectory,
    findOpenAccessRequestForUser,
    sortUsersDirectoryRows,
    type UsersDirectoryRow,
    type UsersDirectorySortDir,
    type UsersDirectorySortKey,
    type UsersDirectoryTableEntry
} from "@/lib/admin/users-directory";
import { fetchAdminManageUsersDirectory } from "@/lib/react-query/admin-manage-users-api";
import { adminManageUsersQueryKeys } from "@/lib/react-query/query-keys";
import {
    normalizeSubscriptionPlan,
    SUBSCRIPTION_PLAN_SELECT_OPTIONS,
    type SubscriptionPlan
} from "@/lib/subscription-plan";
import { formatUserFacingIdentityLabel } from "@/lib/x-identity-email";

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

type UserTenantMembershipRow = {
  tenantId: string;
  slug: string;
  name: string;
  tenantRole: "tenant_admin" | "member";
  isDefaultSessionTenant: boolean;
};

type ApiUserBillingOverride = {
  enabled: boolean;
  reason?: string;
  grantedByUserId?: string;
  grantedAt?: string;
  expiresAt?: string;
};

type ApiUserBilling = {
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  stripeCurrentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
  override?: ApiUserBillingOverride;
};

type ApprovedUser = {
  userId: string;
  name: string;
  email: string;
  /** True when core user has no platform roles yet (e.g. onboarding test pending approve). */
  pendingAccess: boolean;
  userStatus: "active" | "suspended";
  role: "global_admin" | "advisor" | "operator" | "viewer";
  subscriptionPlan: SubscriptionPlan;
  tenantMemberships: UserTenantMembershipRow[];
  billing?: ApiUserBilling;
  hasPassword?: boolean;
  credentialInviteExpiresAt?: string | null;
  resendPasswordInviteAvailable?: boolean;
  resendPasswordInviteBlockedReason?: string | null;
  resendPasswordInviteForceAvailable?: boolean;
  resendPasswordInviteForceBlockedReason?: string | null;
  resendEmailVerificationAvailable?: boolean;
  resendEmailVerificationBlockedReason?: string | null;
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

type TenantOption = {
  tenantId: string;
  slug: string;
  name: string;
};

type ApiUser = {
  _id?: string;
  email: string;
  /** Empty before access request approval (onboarding test / email-only request path). */
  roles: Array<"global_admin" | "advisor" | "operator" | "viewer">;
  subscriptionPlan: SubscriptionPlan;
  status: "active" | "suspended";
  billing?: ApiUserBilling;
  hasPassword?: boolean;
  credentialInviteExpiresAt?: string | null;
  resendPasswordInviteAvailable?: boolean;
  resendPasswordInviteBlockedReason?: string | null;
  resendPasswordInviteForceAvailable?: boolean;
  resendPasswordInviteForceBlockedReason?: string | null;
  resendEmailVerificationAvailable?: boolean;
  resendEmailVerificationBlockedReason?: string | null;
  tenantMemberships?: UserTenantMembershipRow[];
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

type BillingOverrideEditState = {
  enabled: boolean;
  reason: string;
  expiresAtLocal: string;
};

const ROLE_SELECT_OPTIONS: ReadonlyArray<ApprovedUser["role"]> = [
  "global_admin",
  "advisor",
  "operator",
  "viewer"
];

function canResendPasswordInvite(user: ApprovedUser): boolean {
  return Boolean(
    user.resendPasswordInviteAvailable ||
      (user.hasPassword && user.resendPasswordInviteForceAvailable)
  );
}

function passwordInviteHoverHint(user: ApprovedUser): string {
  if (user.resendPasswordInviteAvailable) {
    return "Reissue password-setup email (7-day link; prior links invalidate)";
  }
  if (user.hasPassword && user.resendPasswordInviteForceAvailable) {
    return "Clear current password and send a new 7-day password-setup link";
  }
  return (
    user.resendPasswordInviteForceBlockedReason ??
    user.resendPasswordInviteBlockedReason ??
    "Password invite not available"
  );
}

function shortMongoObjectIdHex(id: string | null | undefined): string {
  if (!id?.trim()) {
    return "—";
  }
  const trimmed = id.trim();
  if (trimmed.length <= 14) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

function primaryTenantIdForUser(user: ApprovedUser): string {
  const membership =
    user.tenantMemberships.find((m) => m.isDefaultSessionTenant) ?? user.tenantMemberships[0];
  return membership?.tenantId ?? "";
}

function userDirectoryStatusLabel(user: ApprovedUser): string {
  if (user.pendingAccess) {
    return `pending access · ${user.userStatus}`;
  }
  return user.userStatus;
}

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

async function writeTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* continue to fallback */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) {
    throw new Error("copy_failed");
  }
}

type ManageUsersDirectoryData = {
  users: ApprovedUser[];
  openAccessRequests: AdminAccessRequest[];
  personaByUserId: Record<string, string>;
  linkedCollectionsByUserId: Record<string, LinkedCollection[]>;
};

export function UserSettingsConsole() {
  const [status, setStatus] = useState("Ready");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAccessRequestId, setSelectedAccessRequestId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [arEmailEdits, setArEmailEdits] = useState<Record<string, string>>({});
  const [arPlanEdits, setArPlanEdits] = useState<Record<string, SubscriptionPlan>>({});
  const [arRoleEdits, setArRoleEdits] = useState<Record<string, ApprovedUser["role"]>>({});
  const [arTenantEdits, setArTenantEdits] = useState<Record<string, string>>({});
  const [arReviewNoteEdits, setArReviewNoteEdits] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<UsersDirectorySortKey>("name");
  const [sortDir, setSortDir] = useState<UsersDirectorySortDir>("asc");
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({});
  const [roleEdits, setRoleEdits] = useState<Record<string, ApprovedUser["role"]>>({});
  const [planEdits, setPlanEdits] = useState<Record<string, ApprovedUser["subscriptionPlan"]>>({});
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<ApprovedUser["role"]>("operator");
  const [newUserPlan, setNewUserPlan] = useState<ApprovedUser["subscriptionPlan"]>("basic");
  const onboardingRequiresApproval = true;
  const [isCreateUserPanelOpen, setIsCreateUserPanelOpen] = useState(false);
  const [isUserSettingsPanelOpen, setIsUserSettingsPanelOpen] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantEdits, setTenantEdits] = useState<Record<string, string>>({});
  const [tenantRoleEdits, setTenantRoleEdits] = useState<Record<string, "tenant_admin" | "member">>({});

  const [settingsForm, setSettingsForm] = useState<UserAdminSettingsPayload>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLastSaved, setSettingsLastSaved] = useState<string | null>(null);
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([]);
  const [personaByUserId, setPersonaByUserId] = useState<Record<string, string>>({});
  const [linkedCollectionsByUserId, setLinkedCollectionsByUserId] = useState<
    Record<string, LinkedCollection[]>
  >({});
  const [billingOverrideEdits, setBillingOverrideEdits] = useState<
    Record<string, BillingOverrideEditState>
  >({});
  const [copiedClipboardKey, setCopiedClipboardKey] = useState<string | null>(null);

  const syncDirectoryEditFields = useCallback(
    (normalizedUsers: ApprovedUser[], accessRows: AdminAccessRequest[]) => {
      setArEmailEdits((previous) => {
        const next = { ...previous };
        for (const item of accessRows) {
          next[item.userId] = previous[item.userId] ?? item.user?.email ?? "";
        }
        return next;
      });
      setArPlanEdits((previous) => {
        const next = { ...previous };
        for (const item of accessRows) {
          if (!item._id) continue;
          next[item._id] = normalizeSubscriptionPlan(
            previous[item._id] ?? (item.requestedPlan as SubscriptionPlan) ?? "basic"
          );
        }
        return next;
      });
      setArRoleEdits((previous) => {
        const next = { ...previous };
        for (const item of accessRows) {
          if (!item._id) continue;
          next[item._id] = previous[item._id] ?? item.requestedRole ?? "operator";
        }
        return next;
      });
      setArTenantEdits((previous) => {
        const next = { ...previous };
        for (const item of accessRows) {
          if (!item._id) continue;
          next[item._id] = previous[item._id] ?? item.tenantId ?? "";
        }
        return next;
      });
      setArReviewNoteEdits((previous) => {
        const next = { ...previous };
        for (const item of accessRows) {
          if (!item._id) continue;
          next[item._id] = previous[item._id] ?? "";
        }
        return next;
      });
      setEmailEdits((previous) => {
        const next = { ...previous };
        for (const user of normalizedUsers) {
          next[user.userId] = previous[user.userId] ?? user.email ?? "";
        }
        return next;
      });
      setRoleEdits((previous) => {
        const next = { ...previous };
        for (const user of normalizedUsers) {
          next[user.userId] = previous[user.userId] ?? user.role;
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
      setTenantEdits((previous) => {
        const next = { ...previous };
        for (const user of normalizedUsers) {
          const preferredMembership =
            user.tenantMemberships.find((membership) => membership.isDefaultSessionTenant) ??
            user.tenantMemberships[0];
          next[user.userId] = previous[user.userId] ?? preferredMembership?.tenantId ?? "";
        }
        return next;
      });
      setTenantRoleEdits((previous) => {
        const next = { ...previous };
        for (const user of normalizedUsers) {
          const preferredMembership =
            user.tenantMemberships.find((membership) => membership.isDefaultSessionTenant) ??
            user.tenantMemberships[0];
          next[user.userId] = previous[user.userId] ?? preferredMembership?.tenantRole ?? "member";
        }
        return next;
      });
      setBillingOverrideEdits((previous) => {
        const next = { ...previous };
        for (const user of normalizedUsers) {
          next[user.userId] = billingOverrideStateFromApiBilling(user.billing?.override);
        }
        return next;
      });
    },
    []
  );

  const loadDirectory = useCallback(async (): Promise<ManageUsersDirectoryData> => {
    const payload = await fetchAdminManageUsersDirectory();
    const normalizedUsers = payload.users
      .filter((user): user is ApiUser & { _id: string } => Boolean(user._id))
      .map((user) => toApprovedUser(user));
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
    const linkedCollectionsByUserId: Record<string, LinkedCollection[]> = {};
    for (const entry of settingsEntries) {
      linkedCollectionsByUserId[entry.userId] = entry.linkedCollections;
    }
    return {
      users: normalizedUsers,
      openAccessRequests: payload.openAccessRequests,
      personaByUserId: Object.fromEntries(
        settingsEntries.map((entry) => [entry.userId, entry.assignedPersonaId])
      ),
      linkedCollectionsByUserId
    };
  }, []);

  const directoryQuery = useQuery({
    queryKey: adminManageUsersQueryKeys.directory,
    queryFn: loadDirectory
  });

  const approvedUsers = useMemo(() => directoryQuery.data?.users ?? [], [directoryQuery.data?.users]);
  const openAccessRequests = useMemo(
    () => directoryQuery.data?.openAccessRequests ?? [],
    [directoryQuery.data?.openAccessRequests]
  );

  useEffect(() => {
    if (!directoryQuery.data) {
      return;
    }
    syncDirectoryEditFields(directoryQuery.data.users, directoryQuery.data.openAccessRequests);
    setPersonaByUserId(directoryQuery.data.personaByUserId);
    setLinkedCollectionsByUserId(directoryQuery.data.linkedCollectionsByUserId);
  }, [directoryQuery.data, syncDirectoryEditFields]);

  const refreshDirectory = useCallback(async () => {
    try {
      const result = await directoryQuery.refetch();
      if (result.error) {
        throw result.error;
      }
      setStatus("Directory synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load directory");
    }
  }, [directoryQuery]);

  const refreshTenants = useCallback(async () => {
    try {
      const payload = await parseJson<{
        data: Array<{ tenantId: string; slug: string; name: string }>;
      }>(await fetch("/api/admin/tenants"));
      const options = payload.data
        .map((tenant) => ({
          tenantId: tenant.tenantId,
          slug: tenant.slug,
          name: tenant.name
        }))
        .sort((a, b) => a.slug.localeCompare(b.slug));
      setTenantOptions(options);
    } catch {
      setTenantOptions([]);
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
    const role = roleEdits[userId] ?? "operator";
    const subscriptionPlan = planEdits[userId] ?? "basic";
    const selectedTenantId = tenantEdits[userId] ?? "";
    const selectedTenantRole = tenantRoleEdits[userId] ?? "member";
    const priorPlan = normalizeSubscriptionPlan(
      approvedUsers.find((u) => u.userId === userId)?.subscriptionPlan ?? "basic"
    );
    const nextPlan = normalizeSubscriptionPlan(subscriptionPlan);
    setStatus(`Saving user changes for ${userId}...`);
    const billingOverride = buildBillingOverridePayload(billingOverrideEdits[userId]);
    try {
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            role,
            subscriptionPlan,
            ...(billingOverride ? { billingOverride } : {})
          })
        })
      );
      if (selectedTenantId) {
        await parseJson(
          await fetch(`/api/admin/tenants/${encodeURIComponent(selectedTenantId)}/memberships`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              tenantRole: selectedTenantRole
            })
          })
        );
      }
      if (priorPlan !== nextPlan) {
        await parseJson(
          await fetch(`/api/admin/users/${encodeURIComponent(userId)}/metered-usage/reset`, {
            method: "POST"
          })
        );
      }
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
      await refreshDirectory();
      setEditingUserId(null);
      setStatus("User changes saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save user changes");
    }
  }

  async function resetUserMeteredUsage(userId: string, emailLabel: string) {
    const ok = window.confirm(
      `Reset xChat and app feature usage counters for ${emailLabel}? This clears rate/daily buckets in Mongo for today.`
    );
    if (!ok) {
      return;
    }
    setStatus(`Resetting usage for ${userId}...`);
    try {
      const payload = await parseJson<{
        data: { xchatUsageDeleted: number; featureDailyDeleted: number };
      }>(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/metered-usage/reset`, {
          method: "POST"
        })
      );
      setStatus(
        `Usage reset: xChat buckets ${payload.data.xchatUsageDeleted}, feature daily ${payload.data.featureDailyDeleted}`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to reset usage");
    }
  }

  async function resendCredentialInvite(userId: string, emailLabel: string) {
    const row = approvedUsers.find((u) => u.userId === userId);
    const forcePasswordRotate = Boolean(row?.hasPassword && row.resendPasswordInviteForceAvailable);
    const ok = window.confirm(
      forcePasswordRotate
        ? `Clear ${emailLabel}'s current password and send a new 7-day password-setup link? They must choose a new password.`
        : `Send a new password-setup email to ${emailLabel}? Previous invite links stop working once a new token is issued.`
    );
    if (!ok) {
      return;
    }
    setStatus(`Resending password invite to ${emailLabel}…`);
    try {
      const payload = await parseJson<{
        data: { emailedTo: string; credentialInviteExpiresAt: string | null };
      }>(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/resend-credential-invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forcePasswordRotate ? { forcePasswordRotate: true } : {})
        })
      );
      const exp = payload.data.credentialInviteExpiresAt
        ? new Date(payload.data.credentialInviteExpiresAt).toLocaleString()
        : "unknown";
      setStatus(`Password invite sent to ${payload.data.emailedTo} (link expires ${exp}).`);
      await refreshDirectory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to resend invite");
    }
  }

  async function resendEmailVerification(userId: string, emailLabel: string) {
    const ok = window.confirm(
      [
        `Send a new email verification link to ${emailLabel}?`,
        "",
        "This clears their saved password and un-verifies their email until they complete the new link — they must set a new password afterward (send password setup email if needed)."
      ].join("\n")
    );
    if (!ok) {
      return;
    }
    setStatus(`Resending verification email to ${emailLabel}…`);
    try {
      const payload = await parseJson<{
        data: { emailedTo: string; emailVerificationExpiresAt: string | null };
      }>(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/resend-email-verification`, {
          method: "POST"
        })
      );
      const exp = payload.data.emailVerificationExpiresAt
        ? new Date(payload.data.emailVerificationExpiresAt).toLocaleString()
        : "unknown";
      setStatus(`Verification email sent to ${payload.data.emailedTo} (link expires ${exp}).`);
      await refreshDirectory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to resend verification");
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = newUserEmail.trim().toLowerCase();
    if (!email) {
      setStatus("Email is required.");
      return;
    }
    setStatus("Creating pending access request...");
    try {
      await parseJson(
        await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            role: newUserRole,
            subscriptionPlan: newUserPlan,
            reason: "Admin onboarding — email required; approve before sign-in (Manage Users)"
          })
        })
      );
      setNewUserEmail("");
      setNewUserRole("operator");
      setNewUserPlan("basic");
      setIsCreateUserPanelOpen(false);
      await refreshDirectory();
      setStatus(
        "Pending access request created — approve from this directory (table or access panel), then the user can sign in."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create access request");
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
      await refreshDirectory();
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
    const row = approvedUsers.find((u) => u.userId === selectedUserId);
    const billingEdits =
      billingOverrideEdits[selectedUserId] ?? billingOverrideStateFromApiBilling(row?.billing?.override);
    const billingOverride = buildBillingOverridePayload(billingEdits)!;
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

      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(selectedUserId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billingOverride })
        })
      );

      await refreshDirectory();
      setStatus("Settings and billing override saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save settings");
    }
  }

  function selectUser(userId: string) {
    setSelectedAccessRequestId(null);
    setSelectedUserId(userId);
    void loadUserSettings(userId);
    const user = approvedUsers.find((row) => row.userId === userId);
    setIsUserSettingsPanelOpen(!user?.pendingAccess);
  }

  function selectAccessRequest(requestId: string) {
    setSelectedAccessRequestId(requestId);
    setSelectedUserId(null);
    setEditingUserId(null);
    setIsUserSettingsPanelOpen(false);
  }

  function toggleDirectorySort(key: UsersDirectorySortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function reviewAccessRequest(requestId: string, statusValue: "approved" | "rejected") {
    const row = openAccessRequests.find((r) => r._id === requestId);
    const tenant = (arTenantEdits[requestId]?.trim() || row?.tenantId?.trim() || "").trim();
    const plan = arPlanEdits[requestId] ?? row?.requestedPlan;
    const role = arRoleEdits[requestId] ?? row?.requestedRole;
    const reviewNoteRaw = arReviewNoteEdits[requestId]?.trim() ?? "";
    if (statusValue === "approved") {
      if (!tenant) {
        setStatus("Select a tenant before approving.");
        return;
      }
      if (!plan) {
        setStatus("Select a plan before approving.");
        return;
      }
      if (!role) {
        setStatus("Select a role before approving.");
        return;
      }
    }
    setStatus(statusValue === "approved" ? "Approving…" : "Rejecting…");
    try {
      const body: Record<string, unknown> = { status: statusValue };
      if (statusValue === "approved") {
        body.requestedRole = role;
        body.requestedPlan = plan;
        body.targetTenantId = tenant;
      }
      if (reviewNoteRaw) {
        body.reviewNote = reviewNoteRaw;
      }
      const payload = await parseJson<{
        data: unknown;
        meta?: {
          approvalEmail?: {
            deskSmtpConfigured: boolean;
            sent: boolean;
            skipped?: boolean;
            skipReason?: string;
            configHint?: string;
            sendErrorHint?: string;
          };
        };
      }>(
        await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
          method: "PUT",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      );
      setSelectedAccessRequestId(null);
      await refreshDirectory();
      let done =
        statusValue === "approved" ? "Access request approved" : "Access request rejected";
      if (statusValue === "approved" && payload.meta?.approvalEmail) {
        const m = payload.meta.approvalEmail;
        if (m.skipped && m.skipReason === "no_deliverable_email") {
          done += " — No deliverable email (set a real contact email on the request).";
        } else if (m.skipped && m.skipReason === "no_user") {
          done += " — User row missing; no email sent.";
        } else if (!m.sent && !m.deskSmtpConfigured) {
          done +=
            " — Desk SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM in .env).";
          if (m.configHint) {
            done += ` (${m.configHint})`;
          }
        } else if (!m.sent) {
          done += " — Approval email failed to send (check server logs / SMTP).";
          if (m.sendErrorHint) {
            done += ` (${m.sendErrorHint})`;
          }
        } else {
          done += " — Notification email sent.";
        }
      }
      setStatus(done);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update request");
    }
  }

  async function updateArUserEmail(userId: string) {
    const email = arEmailEdits[userId]?.trim().toLowerCase() ?? "";
    if (!email) {
      setStatus("Email is required.");
      return;
    }
    setStatus("Updating user email…");
    try {
      await parseJson(
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email`, {
          method: "PATCH",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        })
      );
      await refreshDirectory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update email");
    }
  }

  async function updateAccessRequestPlanOnly(requestId: string) {
    setStatus("Updating plan…");
    try {
      await parseJson(
        await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
          method: "PUT",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestedPlan: arPlanEdits[requestId] ?? "basic" })
        })
      );
      await refreshDirectory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update plan");
    }
  }

  async function updateAccessRequestTenantOnly(requestId: string) {
    setStatus("Updating tenant…");
    try {
      await parseJson(
        await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
          method: "PUT",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetTenantId: arTenantEdits[requestId] ?? "" })
        })
      );
      await refreshDirectory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update tenant");
    }
  }

  async function deleteAccessRequestRow(requestId: string) {
    setStatus("Deleting request…");
    try {
      await parseJson(
        await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
          method: "DELETE",
          cache: "no-store"
        })
      );
      if (selectedAccessRequestId === requestId) {
        setSelectedAccessRequestId(null);
      }
      await refreshDirectory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshTenants();
      void refreshPersonaOptions();
    }, 0);
    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [refreshPersonaOptions, refreshTenants]);

  const selectedLinkedCollections = selectedUserId
    ? linkedCollectionsByUserId[selectedUserId] ?? []
    : [];
  const selectedUserRow = selectedUserId
    ? approvedUsers.find((u) => u.userId === selectedUserId)
    : undefined;
  const pendingUserAccessRequest =
    selectedUserId && selectedUserRow?.pendingAccess
      ? findOpenAccessRequestForUser(selectedUserId, openAccessRequests)
      : undefined;
  const accessRequestPanelId =
    selectedAccessRequestId ?? pendingUserAccessRequest?._id ?? null;
  const accessRequestPanel = accessRequestPanelId
    ? openAccessRequests.find((r) => r._id === accessRequestPanelId)
    : undefined;

  const { userDirectoryRows, accessRequestDirectoryRows, directoryTableEntries } = useMemo(() => {
    const pendingUsers = approvedUsers.map((u) => ({
      userId: u.userId,
      pendingAccess: u.pendingAccess
    }));
    const visibleUserIds = new Set(
      filterUsersForDirectory(pendingUsers, openAccessRequests).map((user) => user.userId)
    );
    const usersPart: UsersDirectoryRow[] = approvedUsers
      .filter((user) => visibleUserIds.has(user.userId))
      .map((u) => ({
        kind: "user",
        userId: u.userId,
        name: u.name,
        email: u.email,
        tenantId: primaryTenantIdForUser(u),
        roleLabel: u.pendingAccess ? "pending" : u.role,
        planLabel: u.subscriptionPlan,
        statusLabel: userDirectoryStatusLabel(u),
        pendingAccess: u.pendingAccess,
        userStatus: u.userStatus
      }));
    const filteredAr = filterAccessRequestsForDirectory(pendingUsers, openAccessRequests);
    const arPart: UsersDirectoryRow[] = filteredAr
      .filter((r): r is AdminAccessRequest & { _id: string } => Boolean(r._id))
      .map((r) => ({
        kind: "access_request",
        requestId: r._id,
        userId: r.userId,
        name: formatUserFacingIdentityLabel(r.user, r.userId),
        email: r.user?.email ?? arEmailEdits[r.userId] ?? "—",
        tenantId: (arTenantEdits[r._id] ?? r.tenantId ?? "").trim(),
        roleLabel: arRoleEdits[r._id] ?? r.requestedRole,
        planLabel: String(arPlanEdits[r._id] ?? r.requestedPlan ?? "basic"),
        statusLabel: r.status,
        arStatus: r.status
      }));
    const userDirectoryRows = sortUsersDirectoryRows(usersPart, sortKey, sortDir);
    const accessRequestDirectoryRows = sortUsersDirectoryRows(arPart, sortKey, sortDir);
    return {
      userDirectoryRows,
      accessRequestDirectoryRows,
      directoryTableEntries: buildGroupedDirectoryTableEntries(
        userDirectoryRows,
        accessRequestDirectoryRows
      )
    };
  }, [
    approvedUsers,
    openAccessRequests,
    arEmailEdits,
    arTenantEdits,
    arRoleEdits,
    arPlanEdits,
    sortKey,
    sortDir
  ]);

  const copyMongoObjectId = useCallback(async (key: string, id: string, label: string) => {
    try {
      await writeTextToClipboard(id);
      setCopiedClipboardKey(key);
      setStatus(`Copied ${label} (${id})`);
      window.setTimeout(() => {
        setCopiedClipboardKey((current) => (current === key ? null : current));
      }, 2000);
    } catch {
      setStatus(`Could not copy ${label} — select the id text manually.`);
    }
  }, []);

  const SortHeader = ({ col, label }: { col: UsersDirectorySortKey; label: string }) => (
    <th
      aria-sort={
        sortKey === col ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
      scope="col"
    >
      <button
        aria-label={`Sort by ${label}`}
        className="admin-users-dir-table__sort"
        type="button"
        onClick={() => toggleDirectorySort(col)}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="admin-users-dir-table__sort-indicator">
          {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" onClick={() => void refreshDirectory()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh directory
        </button>
        <button
          aria-expanded={isCreateUserPanelOpen}
          className="cta cta-primary"
          onClick={() => setIsCreateUserPanelOpen((open) => !open)}
          type="button"
        >
          <AddIcon className="crud-icon" /> Create user
        </button>
        <button
          aria-expanded={isUserSettingsPanelOpen}
          className="cta cta-secondary"
          disabled={!selectedUserId || Boolean(accessRequestPanelId)}
          onClick={() => setIsUserSettingsPanelOpen((open) => !open)}
          type="button"
        >
          <EditIcon className="crud-icon" /> User settings
        </button>
        <p className="status-text">{status}</p>
      </div>

      {isCreateUserPanelOpen ? (
        <article className="surface-card xf-widget section-card admin-users-directory__create-panel">
          <div className="admin-users-directory__create-panel-header">
            <h3>Create user</h3>
            <button
              aria-label="Close create user panel"
              className="tiny-button"
              onClick={() => setIsCreateUserPanelOpen(false)}
              type="button"
            >
              <XMarkIcon className="crud-icon" /> Close
            </button>
          </div>
          <form className="stack-form admin-users-directory__create-form" onSubmit={createUser}>
            <input
              onChange={(event) => setNewUserEmail(event.target.value)}
              placeholder="new user email"
              required
              type="email"
              value={newUserEmail}
            />
            <select
              onChange={(event) => setNewUserRole(event.target.value as ApprovedUser["role"])}
              value={newUserRole}
              aria-label="Requested role (applied when access request is approved)"
            >
              {ROLE_SELECT_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              onChange={(event) =>
                setNewUserPlan(event.target.value as ApprovedUser["subscriptionPlan"])
              }
              value={newUserPlan}
              aria-label="Requested plan (applied when access request is approved)"
            >
              {SUBSCRIPTION_PLAN_SELECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="admin-users-directory__onboarding-toggle">
              <label className="admin-users-directory__onboarding-toggle-label">
                <input
                  checked={onboardingRequiresApproval}
                  readOnly
                  disabled
                  type="checkbox"
                />
                <span>Approval required</span>
              </label>
              <p className="admin-users-directory__onboarding-copy">
                Email is required. Users stay pending until you approve the access request (app, OAuth,
                guest signup, and rental tenant admins use the same gate).
              </p>
            </div>
            <div className="tool-row">
              <button className="cta cta-primary" type="submit">
                <AddIcon className="crud-icon" />{" "}
                Create pending access request
              </button>
              <button
                className="cta cta-secondary"
                onClick={() => setIsCreateUserPanelOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
          <details className="mt-3 text-sm opacity-90">
            <summary className="cursor-pointer select-none font-medium">Approval loop</summary>
            <ol className="mt-2 ml-4 list-decimal space-y-1">
              <li>Submit email + requested role/plan — user row appears with no login role until approval.</li>
              <li>
                Approve from the <strong>access request</strong> row or side panel — user gains roles and can
                sign in.
              </li>
              <li>
                <strong>Delete</strong> on the row wipes the user and related rows when you need to re-test.
              </li>
            </ol>
          </details>
        </article>
      ) : null}

      {selectedUserId && isUserSettingsPanelOpen && !accessRequestPanelId ? (
        <article className="surface-card xf-widget section-card admin-users-directory__settings-panel">
          <div className="admin-users-directory__create-panel-header">
            <h3>
              User settings for {approvedUsers.find((u) => u.userId === selectedUserId)?.name ?? selectedUserId}
            </h3>
            <button
              aria-label="Close user settings panel"
              className="tiny-button"
              onClick={() => setIsUserSettingsPanelOpen(false)}
              type="button"
            >
              <XMarkIcon className="crud-icon" /> Close
            </button>
          </div>
          <p className="status-text flex flex-wrap items-center gap-2">
            <span className="opacity-80">core_users._id</span>
            <span className="font-mono text-xs break-all">{selectedUserId}</span>
            <XfHoverHint
              hint={copiedClipboardKey === `user:${selectedUserId}` ? "Copied user id" : "Copy user id"}
            >
              <button
                aria-label={
                  copiedClipboardKey === `user:${selectedUserId}`
                    ? "User id copied to clipboard"
                    : `Copy user id ${selectedUserId}`
                }
                className="tiny-button xf-icon-edit-btn--icon-only shrink-0"
                onClick={() =>
                  void copyMongoObjectId(`user:${selectedUserId}`, selectedUserId, "user id")
                }
                type="button"
              >
                <CopyIcon className="crud-icon" />
              </button>
            </XfHoverHint>
          </p>
          {selectedUserRow?.tenantMemberships.length ? (
            <ul className="status-text m-0 list-none space-y-2 p-0">
              {selectedUserRow.tenantMemberships.map((membership) => (
                <li className="flex flex-wrap items-center gap-2" key={membership.tenantId}>
                  <span className="opacity-80">core_tenants._id</span>
                  <span className="font-mono text-xs break-all">{membership.tenantId}</span>
                  {membership.slug ? (
                    <span className="text-xs opacity-80">
                      ({membership.slug}
                      {membership.name ? ` · ${membership.name}` : ""})
                    </span>
                  ) : null}
                  <XfHoverHint
                    hint={
                      copiedClipboardKey === `tenant:${membership.tenantId}`
                        ? "Copied tenant id"
                        : "Copy tenant id"
                    }
                  >
                    <button
                      aria-label={
                        copiedClipboardKey === `tenant:${membership.tenantId}`
                          ? "Tenant id copied to clipboard"
                          : `Copy tenant id ${membership.tenantId}`
                      }
                      className="tiny-button xf-icon-edit-btn--icon-only shrink-0"
                      onClick={() =>
                        void copyMongoObjectId(
                          `tenant:${membership.tenantId}`,
                          membership.tenantId,
                          "tenant id"
                        )
                      }
                      type="button"
                    >
                      <CopyIcon className="crud-icon" />
                    </button>
                  </XfHoverHint>
                </li>
              ))}
            </ul>
          ) : null}
          {settingsLastSaved ? (
            <p className="status-text">Last saved: {new Date(settingsLastSaved).toLocaleString()}</p>
          ) : null}
          {settingsLoading ? (
            <p className="status-text">Loading settings...</p>
          ) : (
            <form className="stack-form" onSubmit={saveSettings}>
              <fieldset>
                <legend>Billing override (override_active)</legend>
                <p className="status-text">
                  When enabled, product access follows{" "}
                  <span className="font-medium">override_active</span> regardless of Stripe status. Use{" "}
                  <strong>Save settings</strong> below. You can also include override changes when you click{" "}
                  <strong>Save</strong> on the user row (with Edit user active), together with email, role, and
                  plan.
                </p>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    checked={billingOverrideEdits[selectedUserId]?.enabled ?? false}
                    onChange={(event) =>
                      setBillingOverrideEdits((previous) => ({
                        ...previous,
                        [selectedUserId]: {
                          enabled: event.target.checked,
                          reason: previous[selectedUserId]?.reason ?? "",
                          expiresAtLocal: previous[selectedUserId]?.expiresAtLocal ?? ""
                        }
                      }))
                    }
                    type="checkbox"
                  />
                  Override active
                </label>
                <label>
                  Reason (optional, 3–280 chars when provided)
                  <textarea
                    className="min-h-[4rem] w-full"
                    disabled={!(billingOverrideEdits[selectedUserId]?.enabled ?? false)}
                    onChange={(event) =>
                      setBillingOverrideEdits((previous) => ({
                        ...previous,
                        [selectedUserId]: {
                          enabled: previous[selectedUserId]?.enabled ?? false,
                          reason: event.target.value,
                          expiresAtLocal: previous[selectedUserId]?.expiresAtLocal ?? ""
                        }
                      }))
                    }
                    placeholder="e.g. Partner pilot — comped access through launch"
                    value={billingOverrideEdits[selectedUserId]?.reason ?? ""}
                  />
                </label>
                <label>
                  Expires at (optional, local time)
                  <input
                    disabled={!(billingOverrideEdits[selectedUserId]?.enabled ?? false)}
                    onChange={(event) =>
                      setBillingOverrideEdits((previous) => ({
                        ...previous,
                        [selectedUserId]: {
                          enabled: previous[selectedUserId]?.enabled ?? false,
                          reason: previous[selectedUserId]?.reason ?? "",
                          expiresAtLocal: event.target.value
                        }
                      }))
                    }
                    type="datetime-local"
                    value={billingOverrideEdits[selectedUserId]?.expiresAtLocal ?? ""}
                  />
                </label>
                {selectedUserRow?.billing?.override?.grantedAt ? (
                  <p className="status-text text-xs">
                    Granted {new Date(selectedUserRow.billing.override.grantedAt).toLocaleString()}
                    {selectedUserRow.billing.override.grantedByUserId
                      ? ` · by ${selectedUserRow.billing.override.grantedByUserId}`
                      : null}
                  </p>
                ) : null}
              </fieldset>

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
      ) : null}

      <div className="admin-users-directory">
        <div className="admin-users-directory__main">
          <article className="surface-card xf-widget section-card">
            <h3>
              People ({userDirectoryRows.length} users · {accessRequestDirectoryRows.length} standalone
              access requests)
            </h3>
            <div className="admin-users-dir-table-wrap">
              <table className="admin-users-dir-table">
                <thead>
                  <tr>
                    <SortHeader col="name" label="Name" />
                    <SortHeader col="email" label="Email" />
                    <SortHeader col="userId" label="User ID" />
                    <SortHeader col="tenantId" label="Tenant ID" />
                    <SortHeader col="role" label="Role" />
                    <SortHeader col="plan" label="Plan" />
                    <SortHeader col="status" label="Status" />
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {directoryTableEntries.map((entry: UsersDirectoryTableEntry) => {
                    if (entry.kind === "group") {
                      return (
                        <tr className="admin-users-dir-table__group-row" key={`group-${entry.id}`}>
                          <td colSpan={8}>
                            {entry.label} ({entry.count})
                          </td>
                        </tr>
                      );
                    }

                    const row = entry.row;
                    if (row.kind === "user") {
                      const user = approvedUsers.find((u) => u.userId === row.userId);
                      if (!user) {
                        return null;
                      }
                      const pendingAr = user.pendingAccess
                        ? findOpenAccessRequestForUser(user.userId, openAccessRequests)
                        : undefined;
                      const pendingArId = pendingAr?._id;
                      const pendingArActionable =
                        pendingAr != null && isAdminAccessRequestActionable(pendingAr.status);
                      const pendingArTenantOk =
                        pendingArId != null
                          ? (arTenantEdits[pendingArId]?.trim() || pendingAr?.tenantId?.trim() || "")
                              .trim().length > 0
                          : false;
                      const rowSelected =
                        selectedUserId === row.userId && selectedAccessRequestId == null;
                      return (
                        <tr
                          key={`u-${row.userId}`}
                          className={rowSelected ? "row-selected" : ""}
                        >
                          <td>{row.name}</td>
                          <td>{row.email}</td>
                          <td className="col-mono">
                            <div className="flex items-center gap-1">
                              <span>{shortMongoObjectIdHex(row.userId)}</span>
                              <XfHoverHint
                                hint={
                                  copiedClipboardKey === `user:${row.userId}`
                                    ? "Copied user id"
                                    : "Copy user id"
                                }
                              >
                                <button
                                  aria-label="Copy user id"
                                  className="tiny-button xf-icon-edit-btn--icon-only"
                                  onClick={() =>
                                    void copyMongoObjectId(`user:${row.userId}`, row.userId, "user id")
                                  }
                                  type="button"
                                >
                                  <CopyIcon className="crud-icon" />
                                </button>
                              </XfHoverHint>
                            </div>
                          </td>
                          <td className="col-mono">
                            {row.tenantId ? (
                              <div className="flex items-center gap-1">
                                <span>{shortMongoObjectIdHex(row.tenantId)}</span>
                                <XfHoverHint
                                  hint={
                                    copiedClipboardKey === `tenant:${row.tenantId}`
                                      ? "Copied tenant id"
                                      : "Copy tenant id"
                                  }
                                >
                                  <button
                                    aria-label="Copy tenant id"
                                    className="tiny-button xf-icon-edit-btn--icon-only"
                                    onClick={() =>
                                      void copyMongoObjectId(
                                        `tenant:${row.tenantId}`,
                                        row.tenantId,
                                        "tenant id"
                                      )
                                    }
                                    type="button"
                                  >
                                    <CopyIcon className="crud-icon" />
                                  </button>
                                </XfHoverHint>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{row.roleLabel}</td>
                          <td>{row.planLabel}</td>
                          <td>
                            <span
                              className={`status-pill${
                                user.pendingAccess ? " status-pill--pending" : ""
                              }${user.userStatus === "suspended" ? " status-pill--suspended" : ""}`}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="col-actions">
                            <div className="tool-row">
                              <XfHoverHint hint="Open in side panel">
                                <button
                                  aria-label="Open user"
                                  className="tiny-button xf-icon-edit-btn--icon-only"
                                  onClick={() => selectUser(user.userId)}
                                  type="button"
                                >
                                  <EditIcon className="crud-icon" />
                                </button>
                              </XfHoverHint>
                              <IconEditButton
                                label="Edit user"
                                variant="tiny"
                                onClick={() => {
                                  selectUser(user.userId);
                                  setEditingUserId(user.userId);
                                }}
                              />
                              {user.pendingAccess && pendingArId ? (
                                <>
                                  <XfHoverHint
                                    hint={
                                      !pendingArActionable || !pendingArTenantOk
                                        ? "Approve requires tenant (pick in side panel)"
                                        : "Approve and assign tenant, role, plan"
                                    }
                                  >
                                    <button
                                      aria-label="Approve access request"
                                      className="tiny-button xf-icon-edit-btn--icon-only"
                                      disabled={!pendingArActionable || !pendingArTenantOk}
                                      onClick={() =>
                                        void reviewAccessRequest(pendingArId, "approved")
                                      }
                                      type="button"
                                    >
                                      <ApproveAccessIcon className="crud-icon" />
                                    </button>
                                  </XfHoverHint>
                                  <XfHoverHint hint="Reject this access request">
                                    <button
                                      aria-label="Reject access request"
                                      className="tiny-button xf-icon-edit-btn--icon-only"
                                      disabled={!pendingArActionable}
                                      onClick={() =>
                                        void reviewAccessRequest(pendingArId, "rejected")
                                      }
                                      type="button"
                                    >
                                      <RejectAccessIcon className="crud-icon" />
                                    </button>
                                  </XfHoverHint>
                                </>
                              ) : null}
                              <XfHoverHint hint="Save email, role, plan, tenant, persona, billing">
                                <button
                                  aria-label="Save user row"
                                  className="tiny-button xf-icon-edit-btn--icon-only"
                                  disabled={
                                    editingUserId !== user.userId || selectedUserId !== user.userId
                                  }
                                  onClick={() => void saveUserEdits(user.userId)}
                                  type="button"
                                >
                                  <SaveIcon className="crud-icon" />
                                </button>
                              </XfHoverHint>
                              <XfHoverHint hint="Clears xChat usage limits and app feature daily usage for this user (Mongo, today)">
                                <button
                                  aria-label="Reset usage"
                                  className="tiny-button xf-icon-edit-btn--icon-only"
                                  onClick={() => void resetUserMeteredUsage(user.userId, user.email)}
                                  type="button"
                                >
                                  <SyncArrowsIcon className="crud-icon" />
                                </button>
                              </XfHoverHint>
                              <XfHoverHint hint={passwordInviteHoverHint(user)}>
                                <button
                                  aria-label="Resend password invite"
                                  className="tiny-button xf-icon-edit-btn--icon-only"
                                  disabled={!canResendPasswordInvite(user)}
                                  onClick={() => void resendCredentialInvite(user.userId, user.email)}
                                  type="button"
                                >
                                  <SendIcon className="crud-icon" />
                                </button>
                              </XfHoverHint>
                              <XfHoverHint
                                hint={
                                  user.resendEmailVerificationAvailable
                                    ? "Clear password + un-verify email, then send a new verification link (24h)"
                                    : (user.resendEmailVerificationBlockedReason ??
                                      "Verification resend not available")
                                }
                              >
                                <button
                                  aria-label="Resend email verification"
                                  className="tiny-button xf-icon-edit-btn--icon-only"
                                  disabled={!user.resendEmailVerificationAvailable}
                                  onClick={() => void resendEmailVerification(user.userId, user.email)}
                                  type="button"
                                >
                                  <MailIcon className="crud-icon" />
                                </button>
                              </XfHoverHint>
                              <XfHoverHint hint="Permanently delete user and related data">
                                <button
                                  aria-label="Delete user"
                                  className="tiny-button xf-icon-edit-btn--icon-only"
                                  onClick={() => void deleteUser(user.userId)}
                                  type="button"
                                >
                                  <DeleteIcon className="crud-icon" />
                                </button>
                              </XfHoverHint>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const ar = openAccessRequests.find((r) => r._id === row.requestId);
                    if (!ar?._id) {
                      return null;
                    }
                    const actionable = isAdminAccessRequestActionable(ar.status);
                    const tenantOk =
                      (arTenantEdits[ar._id]?.trim() || ar.tenantId?.trim() || "").trim().length > 0;
                    const rowSelected = selectedAccessRequestId === ar._id;
                    return (
                      <tr key={`ar-${ar._id}`} className={rowSelected ? "row-selected" : ""}>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td className="col-mono">
                          <div className="flex items-center gap-1">
                            <span>{shortMongoObjectIdHex(row.userId)}</span>
                            <XfHoverHint
                              hint={
                                copiedClipboardKey === `user:${row.userId}`
                                  ? "Copied user id"
                                  : "Copy user id"
                              }
                            >
                              <button
                                aria-label="Copy user id"
                                className="tiny-button xf-icon-edit-btn--icon-only"
                                onClick={() => void copyMongoObjectId(`user:${row.userId}`, row.userId, "user id")}
                                type="button"
                              >
                                <CopyIcon className="crud-icon" />
                              </button>
                            </XfHoverHint>
                          </div>
                        </td>
                        <td className="col-mono">
                          {row.tenantId ? (
                            <div className="flex items-center gap-1">
                              <span>{shortMongoObjectIdHex(row.tenantId)}</span>
                              <XfHoverHint
                                hint={
                                  copiedClipboardKey === `tenant:${row.tenantId}`
                                    ? "Copied tenant id"
                                    : "Copy tenant id"
                                }
                              >
                                <button
                                  aria-label="Copy tenant id"
                                  className="tiny-button xf-icon-edit-btn--icon-only"
                                  onClick={() =>
                                    void copyMongoObjectId(
                                      `tenant:${row.tenantId}`,
                                      row.tenantId,
                                      "tenant id"
                                    )
                                  }
                                  type="button"
                                >
                                  <CopyIcon className="crud-icon" />
                                </button>
                              </XfHoverHint>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{row.roleLabel}</td>
                        <td>{row.planLabel}</td>
                        <td>
                          <span className="status-pill status-pill--ar">{row.statusLabel}</span>
                        </td>
                        <td className="col-actions">
                          <div className="tool-row">
                            <XfHoverHint hint="Review access request in side panel">
                              <button
                                aria-label="Open access request"
                                className="tiny-button xf-icon-edit-btn--icon-only"
                                onClick={() => selectAccessRequest(ar._id as string)}
                                type="button"
                              >
                                <EditIcon className="crud-icon" />
                              </button>
                            </XfHoverHint>
                            <IconEditButton
                              label="Update requester email"
                              variant="tiny"
                              onClick={() => void updateArUserEmail(ar.userId)}
                            />
                            <XfHoverHint
                              hint={
                                !actionable || !tenantOk
                                  ? "Approve requires tenant (pick in side panel)"
                                  : "Approve and assign tenant, role, plan"
                              }
                            >
                              <button
                                aria-label="Approve access request"
                                className="tiny-button xf-icon-edit-btn--icon-only"
                                disabled={!actionable || !tenantOk}
                                onClick={() => void reviewAccessRequest(ar._id as string, "approved")}
                                type="button"
                              >
                                <ApproveAccessIcon className="crud-icon" />
                              </button>
                            </XfHoverHint>
                            <XfHoverHint hint="Reject this access request">
                              <button
                                aria-label="Reject access request"
                                className="tiny-button xf-icon-edit-btn--icon-only"
                                disabled={!actionable}
                                onClick={() => void reviewAccessRequest(ar._id as string, "rejected")}
                                type="button"
                              >
                                <RejectAccessIcon className="crud-icon" />
                              </button>
                            </XfHoverHint>
                            <XfHoverHint hint="Delete access request record">
                              <button
                                aria-label="Delete access request"
                                className="tiny-button xf-icon-edit-btn--icon-only"
                                onClick={() => void deleteAccessRequestRow(ar._id as string)}
                                type="button"
                              >
                                <DeleteIcon className="crud-icon" />
                              </button>
                            </XfHoverHint>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <aside className="admin-users-directory__rail">
          {accessRequestPanel && accessRequestPanelId ? (
            <article className="surface-card xf-widget section-card">
              <h3>Access request</h3>
              {selectedUserRow?.pendingAccess && !selectedAccessRequestId ? (
                <p className="status-text text-xs opacity-90">
                  Pending user — pick tenant, role, and plan, then approve.
                </p>
              ) : null}
              <p className="status-text text-xs opacity-90">
                Status: <span className="status-pill status-pill--ar">{accessRequestPanel.status}</span>
              </p>
              <p className="status-text font-mono text-xs break-all">{accessRequestPanel.reason}</p>
              {accessRequestPanel.policyViolations &&
              accessRequestPanel.policyViolations.length > 0 ? (
                <p className="status-text status-error text-xs">
                  {accessRequestPanel.policyViolations.map((v) => v.message).join("; ")}
                </p>
              ) : null}
              <label className="stack-form">
                Requester email
                <input
                  onChange={(event) =>
                    setArEmailEdits((p) => ({
                      ...p,
                      [accessRequestPanel.userId]: event.target.value
                    }))
                  }
                  type="email"
                  value={arEmailEdits[accessRequestPanel.userId] ?? ""}
                />
              </label>
              <label className="stack-form">
                Tenant (required to approve)
                <select
                  disabled={!isAdminAccessRequestActionable(accessRequestPanel.status)}
                  onChange={(event) =>
                    setArTenantEdits((p) => ({
                      ...p,
                      [accessRequestPanelId]: event.target.value
                    }))
                  }
                  value={arTenantEdits[accessRequestPanelId] ?? accessRequestPanel.tenantId ?? ""}
                >
                  <option value="">Select tenant…</option>
                  {tenantOptions.map((t) => (
                    <option key={t.tenantId} value={t.tenantId}>
                      {t.name || t.slug} ({t.slug})
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack-form">
                Role on approve
                <select
                  disabled={!isAdminAccessRequestActionable(accessRequestPanel.status)}
                  onChange={(event) =>
                    setArRoleEdits((p) => ({
                      ...p,
                      [accessRequestPanelId]: event.target.value as ApprovedUser["role"]
                    }))
                  }
                  value={arRoleEdits[accessRequestPanelId] ?? accessRequestPanel.requestedRole}
                >
                  <option value="global_admin">global_admin (elevated)</option>
                  <option value="advisor">advisor</option>
                  <option value="operator">operator</option>
                  <option value="viewer">viewer</option>
                </select>
              </label>
              <label className="stack-form">
                Plan on approve
                <select
                  disabled={!isAdminAccessRequestActionable(accessRequestPanel.status)}
                  onChange={(event) =>
                    setArPlanEdits((p) => ({
                      ...p,
                      [accessRequestPanelId]: normalizeSubscriptionPlan(event.target.value)
                    }))
                  }
                  value={arPlanEdits[accessRequestPanelId] ?? accessRequestPanel.requestedPlan}
                >
                  {ACCESS_REQUEST_PLAN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack-form">
                Review note (optional)
                <textarea
                  className="min-h-[4rem] w-full"
                  disabled={!isAdminAccessRequestActionable(accessRequestPanel.status)}
                  onChange={(event) =>
                    setArReviewNoteEdits((p) => ({ ...p, [accessRequestPanelId]: event.target.value }))
                  }
                  value={arReviewNoteEdits[accessRequestPanelId] ?? ""}
                />
              </label>
              <div className="tool-row flex-wrap">
                <button
                  className="cta cta-secondary"
                  disabled={!isAdminAccessRequestActionable(accessRequestPanel.status)}
                  onClick={() => void updateAccessRequestTenantOnly(accessRequestPanelId)}
                  type="button"
                >
                  Save tenant
                </button>
                <button
                  className="cta cta-secondary"
                  disabled={!isAdminAccessRequestActionable(accessRequestPanel.status)}
                  onClick={() => void updateAccessRequestPlanOnly(accessRequestPanelId)}
                  type="button"
                >
                  Save plan
                </button>
                <button
                  className="cta cta-secondary"
                  onClick={() => void updateArUserEmail(accessRequestPanel.userId)}
                  type="button"
                >
                  Save email
                </button>
              </div>
              <div className="tool-row flex-wrap">
                <button
                  className="cta cta-primary"
                  disabled={
                    !isAdminAccessRequestActionable(accessRequestPanel.status) ||
                    !(arTenantEdits[accessRequestPanelId]?.trim() ||
                      accessRequestPanel.tenantId?.trim() ||
                      "").trim()
                  }
                  onClick={() => void reviewAccessRequest(accessRequestPanelId, "approved")}
                  type="button"
                >
                  <ApproveAccessIcon className="crud-icon" /> Approve
                </button>
                <button
                  className="cta cta-secondary"
                  disabled={!isAdminAccessRequestActionable(accessRequestPanel.status)}
                  onClick={() => void reviewAccessRequest(accessRequestPanelId, "rejected")}
                  type="button"
                >
                  <RejectAccessIcon className="crud-icon" /> Reject
                </button>
                <button
                  className="tiny-button"
                  onClick={() => void deleteAccessRequestRow(accessRequestPanelId)}
                  type="button"
                >
                  <DeleteIcon className="crud-icon" /> Delete request
                </button>
              </div>
            </article>
          ) : null}

          {selectedUserRow && selectedUserId && !accessRequestPanelId ? (
            <article className="surface-card xf-widget section-card">
              <h3>Profile &amp; access</h3>
              <p className="status-text text-xs">
                Edit when <strong>Edit user</strong> is active, then <strong>Save profile</strong>.
              </p>
              <div className="stack-form">
                <label>
                  Email
                  <input
                    disabled={editingUserId !== selectedUserId}
                    onChange={(event) =>
                      setEmailEdits((previous) => ({
                        ...previous,
                        [selectedUserId]: event.target.value
                      }))
                    }
                    type="email"
                    value={emailEdits[selectedUserId] ?? ""}
                  />
                </label>
                <div>
                  <p className="status-text mb-1 text-xs">Tenant membership</p>
                  {selectedUserRow.tenantMemberships.length > 0 ? (
                    <ul className="m-0 list-none space-y-2 p-0">
                      {selectedUserRow.tenantMemberships.map((m) => (
                        <li key={m.tenantId}>
                          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                            {m.isDefaultSessionTenant ? (
                              <span
                                className="shrink-0"
                                style={{ color: "var(--xf-gain-green)" }}
                                aria-label="Default session tenant"
                              >
                                ●
                              </span>
                            ) : null}
                            <span className="font-semibold text-sm">{m.slug}</span>
                            {m.name ? (
                              <span className="status-text text-xs opacity-80">· {m.name}</span>
                            ) : null}
                          </div>
                          {m.tenantId === selectedUserRow.userId ? (
                            <div className="text-xs" style={{ color: "var(--xf-loss-red)" }}>
                              Data issue: tenant id matches user id
                            </div>
                          ) : null}
                          <div className="text-xs opacity-70">{m.tenantRole}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="status-text text-xs">No tenant membership</span>
                  )}
                  <select
                    className="mt-2 w-full"
                    disabled={editingUserId !== selectedUserId}
                    onChange={(event) =>
                      setTenantEdits((previous) => ({
                        ...previous,
                        [selectedUserId]: event.target.value
                      }))
                    }
                    value={tenantEdits[selectedUserId] ?? ""}
                  >
                    <option value="">(no tenant)</option>
                    {tenantOptions.map((tenant) => (
                      <option key={tenant.tenantId} value={tenant.tenantId}>
                        {tenant.slug}
                        {tenant.name ? ` - ${tenant.name}` : ""} ·{" "}
                        {shortMongoObjectIdHex(tenant.tenantId)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="mt-2 w-full"
                    disabled={editingUserId !== selectedUserId}
                    onChange={(event) =>
                      setTenantRoleEdits((previous) => ({
                        ...previous,
                        [selectedUserId]: event.target.value as "tenant_admin" | "member"
                      }))
                    }
                    value={tenantRoleEdits[selectedUserId] ?? "member"}
                  >
                    <option value="member">member</option>
                    <option value="tenant_admin">tenant_admin</option>
                  </select>
                </div>
                <label>
                  Role
                  {selectedUserRow.pendingAccess ? (
                    <p className="status-text text-xs opacity-80">
                      Pending — use Approve in the table or the access request panel above.
                    </p>
                  ) : (
                    <select
                      disabled={editingUserId !== selectedUserId}
                      onChange={(event) =>
                        setRoleEdits((previous) => ({
                          ...previous,
                          [selectedUserId]: event.target.value as ApprovedUser["role"]
                        }))
                      }
                      value={roleEdits[selectedUserId] ?? selectedUserRow.role}
                    >
                      {ROLE_SELECT_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label>
                  Plan
                  <select
                    disabled={editingUserId !== selectedUserId}
                    onChange={(event) =>
                      setPlanEdits((previous) => ({
                        ...previous,
                        [selectedUserId]: event.target.value as ApprovedUser["subscriptionPlan"]
                      }))
                    }
                    value={planEdits[selectedUserId] ?? selectedUserRow.subscriptionPlan}
                  >
                    {SUBSCRIPTION_PLAN_SELECT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Billing override
                  {selectedUserRow.pendingAccess ? (
                    <p className="status-text text-xs opacity-70">—</p>
                  ) : (
                    <select
                      disabled={editingUserId !== selectedUserId}
                      value={
                        (billingOverrideEdits[selectedUserId]?.enabled ??
                          selectedUserRow.billing?.override?.enabled ??
                          false)
                          ? "on"
                          : "off"
                      }
                      onChange={(event) => {
                        const enabled = event.target.value === "on";
                        setBillingOverrideEdits((previous) => ({
                          ...previous,
                          [selectedUserId]: {
                            enabled,
                            reason:
                              previous[selectedUserId]?.reason ??
                              selectedUserRow.billing?.override?.reason ??
                              "",
                            expiresAtLocal:
                              previous[selectedUserId]?.expiresAtLocal ??
                              (selectedUserRow.billing?.override?.expiresAt
                                ? isoToDatetimeLocalValue(selectedUserRow.billing.override.expiresAt)
                                : "")
                          }
                        }));
                      }}
                    >
                      <option value="off">Off</option>
                      <option value="on">On</option>
                    </select>
                  )}
                </label>
                <label>
                  xPersona (row assignment)
                  <select
                    disabled={editingUserId !== selectedUserId}
                    onChange={(event) =>
                      setPersonaByUserId((previous) => ({
                        ...previous,
                        [selectedUserId]: event.target.value
                      }))
                    }
                    value={personaByUserId[selectedUserId] ?? ""}
                  >
                    <option value="">(default persona)</option>
                    {personaOptions.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="status-text text-xs opacity-80">
                  {selectedUserRow.latestAuditEvent
                    ? `${selectedUserRow.latestAuditEvent.action} · ${new Date(
                        selectedUserRow.latestAuditEvent.createdAt
                      ).toLocaleString()}`
                    : selectedUserRow.approvedAt
                      ? new Date(selectedUserRow.approvedAt).toLocaleString()
                      : "No audit row"}
                </p>
                <div className="tool-row flex-wrap">
                  <IconEditButton
                    label="Edit user"
                    variant="secondary-cta"
                    onClick={() => setEditingUserId(selectedUserId)}
                  />
                  <button
                    className="cta cta-primary"
                    disabled={editingUserId !== selectedUserId}
                    onClick={() => void saveUserEdits(selectedUserId)}
                    type="button"
                  >
                    <SaveIcon className="crud-icon" /> Save profile
                  </button>
                  {!selectedUserRow.pendingAccess ? (
                    <>
                      <button
                        className="cta cta-secondary"
                        disabled={!canResendPasswordInvite(selectedUserRow)}
                        onClick={() => void resendCredentialInvite(selectedUserId, selectedUserRow.email)}
                        type="button"
                      >
                        <SendIcon className="crud-icon" /> Password setup email
                      </button>
                      <button
                        className="cta cta-secondary"
                        disabled={!selectedUserRow.resendEmailVerificationAvailable}
                        onClick={() =>
                          void resendEmailVerification(selectedUserId, selectedUserRow.email)
                        }
                        type="button"
                      >
                        <MailIcon className="crud-icon" /> Resend verification
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function toApprovedUser(user: ApiUser & { _id: string }): ApprovedUser {
  const pendingAccess = user.roles.length === 0;
  const role = user.roles[0] ?? "operator";
  return {
    userId: user._id,
    name: user.xAccount?.displayName ?? user.xAccount?.username ?? user.email,
    email: user.email,
    pendingAccess,
    userStatus: user.status,
    role,
    subscriptionPlan: normalizeSubscriptionPlan(user.subscriptionPlan),
    tenantMemberships: user.tenantMemberships ?? [],
    billing: user.billing,
    hasPassword: user.hasPassword,
    credentialInviteExpiresAt: user.credentialInviteExpiresAt ?? null,
    resendPasswordInviteAvailable: user.resendPasswordInviteAvailable ?? false,
    resendPasswordInviteBlockedReason: user.resendPasswordInviteBlockedReason ?? null,
    resendPasswordInviteForceAvailable: user.resendPasswordInviteForceAvailable ?? false,
    resendPasswordInviteForceBlockedReason: user.resendPasswordInviteForceBlockedReason ?? null,
    resendEmailVerificationAvailable: user.resendEmailVerificationAvailable ?? false,
    resendEmailVerificationBlockedReason: user.resendEmailVerificationBlockedReason ?? null,
    approvedAt: user.updatedAt,
    latestAuditEvent: user.latestAuditEvent ?? null
  };
}

function billingOverrideStateFromApiBilling(
  override: ApiUserBillingOverride | undefined
): BillingOverrideEditState {
  return {
    enabled: override?.enabled ?? false,
    reason: override?.reason ?? "",
    expiresAtLocal: override?.expiresAt ? isoToDatetimeLocalValue(override.expiresAt) : ""
  };
}

function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string | undefined {
  const trimmed = local.trim();
  if (!trimmed) {
    return undefined;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    return undefined;
  }
  return d.toISOString();
}

function buildBillingOverridePayload(
  edits: BillingOverrideEditState | undefined
): { enabled: boolean; reason?: string; expiresAt?: string } | undefined {
  if (!edits) {
    return undefined;
  }
  if (!edits.enabled) {
    return { enabled: false };
  }
  const payload: { enabled: boolean; reason?: string; expiresAt?: string } = { enabled: true };
  const reason = edits.reason.trim();
  if (reason.length >= 3) {
    payload.reason = reason.slice(0, 280);
  }
  const expiresAt = datetimeLocalToIso(edits.expiresAtLocal);
  if (expiresAt) {
    payload.expiresAt = expiresAt;
  }
  return payload;
}
