import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteManyLog: Array<{ collection: string; filter: unknown }> = [];

function buildMockDb() {
  deleteManyLog.length = 0;
  return {
    collection(name: string) {
      return {
        createIndex: vi.fn().mockResolvedValue("idx"),
        deleteMany: vi.fn().mockImplementation(async (filter: unknown) => {
          deleteManyLog.push({ collection: name, filter });
          return { deletedCount: 1 };
        }),
        find: () => ({
          project: () => ({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    },
  };
}

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "@/lib/mongodb";
import {
    purgeAllDataAssociatedWithCoreUser,
    purgeEphemeralCoreUserScaffolding,
} from "@/modules/core-admin/repository";

const VALID_HEX = "507f1f77bcf86cd799439011";

describe("purge core user associated data", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(buildMockDb() as never);
  });

  it("purgeAllDataAssociatedWithCoreUser deletes user-scoped collections and email-keyed rows", async () => {
    await purgeAllDataAssociatedWithCoreUser({
      userIdHex: VALID_HEX,
      emailNormalized: "User@Example.com",
    });

    const names = deleteManyLog.map((e) => e.collection);
    expect(names).toContain("core_tenant_memberships");
    expect(names).toContain("admin_access_requests");
    expect(names).toContain("admin_user_settings");
    expect(names).toContain("options_strategy_preferences");
    expect(names).toContain("app_user_recommendations");
    expect(names).toContain("xchat_logs");
    expect(names).toContain("xchat_user_preferences");
    expect(names).toContain("app_feature_daily_usage");
    expect(names).toContain("strategy_jobs");
    expect(names).toContain("audit_login");
    expect(names).toContain("admin_user_bootstrap_profiles");
    expect(names).toContain("admin_scheduled_tasks");

    const oid = new ObjectId(VALID_HEX);
    const xchat = deleteManyLog.find((e) => e.collection === "xchat_logs");
    expect(xchat?.filter).toEqual({
      $or: [{ userId: oid }, { userId: VALID_HEX }],
    });

    const xchatPrefs = deleteManyLog.find((e) => e.collection === "xchat_user_preferences");
    expect(xchatPrefs?.filter).toEqual({ userId: oid });

    const audit = deleteManyLog.find((e) => e.collection === "audit_login");
    expect(audit?.filter).toEqual({
      $or: [{ userId: VALID_HEX }, { email: "user@example.com" }],
    });

    const bootstrap = deleteManyLog.find((e) => e.collection === "admin_user_bootstrap_profiles");
    expect(bootstrap?.filter).toEqual({
      $or: [{ userId: VALID_HEX }, { emailNormalized: "user@example.com" }],
    });

    const task = deleteManyLog.find((e) => e.collection === "admin_scheduled_tasks");
    expect(task?.filter).toEqual({ name: "access-request-bootstrap:user@example.com" });
  });

  it("purgeEphemeralCoreUserScaffolding skips email-keyed scheduled tasks and audit-by-email", async () => {
    await purgeEphemeralCoreUserScaffolding(VALID_HEX);

    const names = deleteManyLog.map((e) => e.collection);
    expect(names).not.toContain("admin_scheduled_tasks");

    const audit = deleteManyLog.find((e) => e.collection === "audit_login");
    expect(audit?.filter).toEqual({ userId: VALID_HEX });

    const bootstrap = deleteManyLog.find((e) => e.collection === "admin_user_bootstrap_profiles");
    expect(bootstrap?.filter).toEqual({ userId: VALID_HEX });
  });

  it("no-ops on invalid ObjectId hex", async () => {
    await purgeAllDataAssociatedWithCoreUser({
      userIdHex: "not-a-valid-id",
      emailNormalized: "a@b.com",
    });
    expect(deleteManyLog).toHaveLength(0);
  });
});
