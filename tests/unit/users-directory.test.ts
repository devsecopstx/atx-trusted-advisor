import { describe, expect, it } from "vitest";

import type { AdminAccessRequest } from "@/lib/admin/admin-access-request";
import {
    buildGroupedDirectoryTableEntries,
    buildUsersDirectoryRows,
    filterAccessRequestsForDirectory,
    filterUsersForDirectory,
    findOpenAccessRequestForUser,
    sortUsersDirectoryRows,
    type UsersDirectoryRow
} from "@/lib/admin/users-directory";

describe("findOpenAccessRequestForUser", () => {
  it("returns the open request for a user id", () => {
    const open: AdminAccessRequest[] = [
      {
        _id: "ar1",
        userId: "u1",
        requestedRole: "operator",
        requestedPlan: "basic",
        reason: "test",
        status: "pending",
        requestedAt: "2026-01-01T00:00:00Z"
      }
    ];
    expect(findOpenAccessRequestForUser("u1", open)?._id).toBe("ar1");
    expect(findOpenAccessRequestForUser("u2", open)).toBeUndefined();
  });
});

describe("filterAccessRequestsForDirectory", () => {
  it("keeps open requests for pending onboarding users", () => {
    const users = [{ userId: "u1", pendingAccess: true }];
    const open: AdminAccessRequest[] = [
      {
        _id: "ar1",
        userId: "u1",
        requestedRole: "operator",
        requestedPlan: "basic",
        reason: "test",
        status: "pending",
        requestedAt: "2026-01-01T00:00:00Z"
      }
    ];
    expect(filterAccessRequestsForDirectory(users, open)).toEqual(open);
  });

  it("keeps open request when user is not pending", () => {
    const users = [{ userId: "u1", pendingAccess: false }];
    const open: AdminAccessRequest[] = [
      {
        _id: "ar1",
        userId: "u1",
        requestedRole: "operator",
        requestedPlan: "basic",
        reason: "test",
        status: "pending",
        requestedAt: "2026-01-01T00:00:00Z"
      }
    ];
    expect(filterAccessRequestsForDirectory(users, open)).toEqual(open);
  });

  it("keeps request for unknown user id", () => {
    const users = [{ userId: "u1", pendingAccess: true }];
    const open: AdminAccessRequest[] = [
      {
        _id: "ar2",
        userId: "u2",
        requestedRole: "viewer",
        requestedPlan: "basic",
        reason: "other",
        status: "new",
        requestedAt: "2026-01-01T00:00:00Z"
      }
    ];
    expect(filterAccessRequestsForDirectory(users, open)).toEqual(open);
  });
});

describe("filterUsersForDirectory", () => {
  it("keeps pending users without an open access request", () => {
    const users = [{ userId: "u1", pendingAccess: true }];
    expect(filterUsersForDirectory(users, [])).toEqual(users);
  });

  it("hides pending users when their open access request is listed", () => {
    const users = [{ userId: "u1", pendingAccess: true }];
    const open: AdminAccessRequest[] = [
      {
        _id: "ar1",
        userId: "u1",
        requestedRole: "operator",
        requestedPlan: "basic",
        reason: "test",
        status: "pending",
        requestedAt: "2026-01-01T00:00:00Z"
      }
    ];
    expect(filterUsersForDirectory(users, open)).toEqual([]);
  });
});

describe("buildUsersDirectoryRows", () => {
  it("lists pending onboarding users only under access requests", () => {
    const rows = buildUsersDirectoryRows(
      [
        {
          userId: "u1",
          name: "test@email.com",
          email: "test@email.com",
          role: "operator",
          subscriptionPlan: "basic",
          pendingAccess: true,
          status: "active",
          tenantMemberships: []
        }
      ],
      [
        {
          _id: "ar1",
          userId: "u1",
          requestedRole: "operator",
          requestedPlan: "basic",
          reason: "Admin onboarding flow test (Manage Users)",
          status: "pending",
          requestedAt: "2026-01-01T00:00:00Z"
        }
      ]
    );

    expect(rows.filter((row) => row.kind === "access_request")).toHaveLength(1);
    expect(rows.filter((row) => row.kind === "user")).toHaveLength(0);
  });
});

describe("buildGroupedDirectoryTableEntries", () => {
  it("groups access requests before users with section headers", () => {
    const userRow: UsersDirectoryRow = {
      kind: "user",
      userId: "u1",
      name: "Alpha",
      email: "a@x.com",
      tenantId: "t1",
      roleLabel: "advisor",
      planLabel: "basic",
      statusLabel: "active",
      pendingAccess: false,
      userStatus: "active"
    };
    const accessRow: UsersDirectoryRow = {
      kind: "access_request",
      requestId: "ar1",
      userId: "u2",
      name: "Beta",
      email: "b@x.com",
      tenantId: "",
      roleLabel: "operator",
      planLabel: "basic",
      statusLabel: "new",
      arStatus: "new"
    };
    const entries = buildGroupedDirectoryTableEntries([userRow], [accessRow]);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "group",
      "row",
      "group",
      "row"
    ]);
    expect(entries[0]).toMatchObject({ kind: "group", id: "access_requests", count: 1 });
    expect(entries[2]).toMatchObject({ kind: "group", id: "users", count: 1 });
  });
});

describe("sortUsersDirectoryRows", () => {
  const rows: UsersDirectoryRow[] = [
    {
      kind: "user",
      userId: "b",
      name: "Beta",
      email: "b@x.com",
      tenantId: "t2",
      roleLabel: "viewer",
      planLabel: "basic",
      statusLabel: "active",
      pendingAccess: false,
      userStatus: "active"
    },
    {
      kind: "access_request",
      requestId: "ar",
      userId: "c",
      name: "Alpha",
      email: "a@x.com",
      tenantId: "",
      roleLabel: "operator",
      planLabel: "basic",
      statusLabel: "new",
      arStatus: "new"
    },
    {
      kind: "user",
      userId: "a",
      name: "Alpha",
      email: "a@y.com",
      tenantId: "t1",
      roleLabel: "advisor",
      planLabel: "premium",
      statusLabel: "active",
      pendingAccess: false,
      userStatus: "active"
    }
  ];

  it("sorts by name ascending", () => {
    const sorted = sortUsersDirectoryRows(rows, "name", "asc");
    expect(sorted.map((r) => r.userId)).toEqual(["a", "c", "b"]);
  });

  it("sorts by email descending", () => {
    const sorted = sortUsersDirectoryRows(rows, "email", "desc");
    expect(sorted[0].email).toBe("b@x.com");
  });
});
