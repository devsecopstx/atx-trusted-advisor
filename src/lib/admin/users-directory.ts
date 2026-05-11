import type { AdminAccessRequest, AdminAccessRequestStatus } from "./admin-access-request";

export type UsersDirectorySortKey =
  | "name"
  | "email"
  | "userId"
  | "tenantId"
  | "role"
  | "plan"
  | "status";

export type UsersDirectorySortDir = "asc" | "desc";

export type UsersDirectoryUserRow = {
  kind: "user";
  userId: string;
  name: string;
  email: string;
  tenantId: string;
  roleLabel: string;
  planLabel: string;
  statusLabel: string;
  pendingAccess: boolean;
  userStatus: "active" | "suspended";
};

export type UsersDirectoryAccessRequestRow = {
  kind: "access_request";
  requestId: string;
  userId: string;
  name: string;
  email: string;
  tenantId: string;
  roleLabel: string;
  planLabel: string;
  statusLabel: string;
  arStatus: AdminAccessRequestStatus;
};

export type UsersDirectoryRow = UsersDirectoryUserRow | UsersDirectoryAccessRequestRow;

type PendingAccessUser = {
  userId: string;
  pendingAccess: boolean;
};

/** Drop open access requests when the user already appears in the directory with pending access. */
export function filterAccessRequestsForDirectory(
  users: PendingAccessUser[],
  openRequests: AdminAccessRequest[]
): AdminAccessRequest[] {
  const pendingIds = new Set(
    users.filter((u) => u.pendingAccess).map((u) => u.userId)
  );
  return openRequests.filter((r) => !pendingIds.has(r.userId));
}

function cmp(a: string, b: string, dir: UsersDirectorySortDir): number {
  const base = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? base : -base;
}

export function sortUsersDirectoryRows(
  rows: UsersDirectoryRow[],
  key: UsersDirectorySortKey,
  dir: UsersDirectorySortDir
): UsersDirectoryRow[] {
  const next = [...rows];
  next.sort((x, y) => {
    const av =
      key === "name"
        ? x.name
        : key === "email"
          ? x.email
          : key === "userId"
            ? x.userId
            : key === "tenantId"
              ? x.tenantId
              : key === "role"
                ? x.roleLabel
                : key === "plan"
                  ? x.planLabel
                  : x.statusLabel;
    const bv =
      key === "name"
        ? y.name
        : key === "email"
          ? y.email
          : key === "userId"
            ? y.userId
            : key === "tenantId"
              ? y.tenantId
              : key === "role"
                ? y.roleLabel
                : key === "plan"
                  ? y.planLabel
                  : y.statusLabel;
    const primary = cmp(av, bv, dir);
    if (primary !== 0) {
      return primary;
    }
    const kindOrder = (k: UsersDirectoryRow) => (k.kind === "user" ? 0 : 1);
    if (kindOrder(x) !== kindOrder(y)) {
      return kindOrder(x) - kindOrder(y);
    }
    return cmp(x.userId, y.userId, "asc");
  });
  return next;
}

type DirectoryUserSource = {
  userId: string;
  name: string;
  email: string;
  role: string;
  subscriptionPlan: string;
  pendingAccess: boolean;
  status?: "active" | "suspended";
  tenantMemberships: Array<{ tenantId: string; isDefaultSessionTenant: boolean }>;
};

export function buildUsersDirectoryRows(
  users: DirectoryUserSource[],
  openRequests: AdminAccessRequest[]
): UsersDirectoryRow[] {
  const filtered = filterAccessRequestsForDirectory(
    users.map((user) => ({ userId: user.userId, pendingAccess: user.pendingAccess })),
    openRequests
  );

  const userRows: UsersDirectoryUserRow[] = users.map((user) => {
    const membership =
      user.tenantMemberships.find((row) => row.isDefaultSessionTenant) ?? user.tenantMemberships[0];
    return {
      kind: "user",
      userId: user.userId,
      name: user.name,
      email: user.email,
      tenantId: membership?.tenantId ?? "",
      roleLabel: user.pendingAccess ? "pending" : user.role,
      planLabel: user.subscriptionPlan,
      statusLabel: user.pendingAccess ? "pending access" : (user.status ?? "active"),
      pendingAccess: user.pendingAccess,
      userStatus: user.status ?? "active"
    };
  });

  const requestRows: UsersDirectoryAccessRequestRow[] = filtered
    .filter((request): request is AdminAccessRequest & { _id: string } => Boolean(request._id))
    .map((request) => ({
      kind: "access_request",
      requestId: request._id,
      userId: request.userId,
      name: request.user?.displayName?.trim() || request.user?.email?.trim() || request.userId,
      email: request.user?.email?.trim() ?? "",
      tenantId: request.tenantId?.trim() ?? "",
      roleLabel: request.requestedRole,
      planLabel: request.requestedPlan,
      statusLabel: request.status,
      arStatus: request.status
    }));

  return [...requestRows, ...userRows];
}
