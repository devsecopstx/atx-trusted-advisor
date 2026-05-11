import { describe, expect, it } from "vitest";

import type { AdminAccessRequest } from "@/lib/admin/admin-access-request";
import {
  filterAccessRequestsForDirectory,
  sortUsersDirectoryRows,
  type UsersDirectoryRow
} from "@/lib/admin/users-directory";

describe("filterAccessRequestsForDirectory", () => {
  it("drops open requests when user row is already pending access", () => {
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
    expect(filterAccessRequestsForDirectory(users, open)).toEqual([]);
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
