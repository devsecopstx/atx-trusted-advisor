import { afterEach, describe, expect, it, vi } from "vitest";

import {
    buildScheduledTaskExecutorIdentity,
    resolveTaskRunExecutorEnvironment
} from "@/lib/scheduled-task-executor-identity";

describe("scheduled-task-executor-identity", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.unstubAllEnvs();
  });

  it("labels local Next dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ATX_DEPLOY_TARGET", "");
    delete process.env.K_SERVICE;
    delete process.env.K_REVISION;

    const ex = buildScheduledTaskExecutorIdentity({ runtime: "next" });
    expect(ex.environment).toBe("local");
    expect(ex.runtime).toBe("next");
    expect(ex.label).toMatch(/^Next · local/);
  });

  it("labels production Spring with revision when on Cloud Run", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATX_DEPLOY_TARGET", "deploy");
    vi.stubEnv("K_SERVICE", "atxfinance-backend");
    vi.stubEnv("K_REVISION", "atxfinance-backend-00099-xyz");

    expect(resolveTaskRunExecutorEnvironment()).toBe("production");
    const ex = buildScheduledTaskExecutorIdentity({ runtime: "spring" });
    expect(ex.label).toContain("Spring");
    expect(ex.label).toContain("production");
    expect(ex.revision).toBe("atxfinance-backend-00099-xyz");
  });

  it("marks Next delegate runs from Spring", () => {
    vi.stubEnv("ATX_DEPLOY_TARGET", "deploy");
    const ex = buildScheduledTaskExecutorIdentity({ runtime: "next", delegateFrom: "spring" });
    expect(ex.delegateFrom).toBe("spring");
    expect(ex.label).toContain("via Spring delegate");
  });
});
