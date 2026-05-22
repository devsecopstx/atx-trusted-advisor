import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    proxyAdminScheduledTasksRequestToBackend,
    shouldProxyAdminScheduledTasksToBackend,
    shouldProxyAdminUsersToBackend,
    shouldSkipAdminScheduledTasksBffProxyForRequest,
    shouldSkipAdminScheduledTasksBffProxyForTaskRunPost
} from "@/lib/backend-bff";

describe("shouldProxyAdminScheduledTasksToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    vi.stubEnv("NODE_ENV", "development");
  });

  it("matches shouldProxyAdminUsersToBackend in all env combinations", () => {
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(shouldProxyAdminUsersToBackend());
  });
});

describe("shouldSkipAdminScheduledTasksBffProxyForRequest", () => {
  it("returns true for GET /api/admin/tasks and GET /api/admin/task-runs", () => {
    expect(
      shouldSkipAdminScheduledTasksBffProxyForRequest(
        new Request("http://test/api/admin/tasks", { method: "GET" })
      )
    ).toBe(true);
    expect(
      shouldSkipAdminScheduledTasksBffProxyForRequest(
        new Request("http://test/api/admin/task-runs?window=24h", { method: "GET" })
      )
    ).toBe(true);
    expect(
      shouldSkipAdminScheduledTasksBffProxyForRequest(
        new Request("http://test/api/admin/tasks/abc/run", { method: "POST" })
      )
    ).toBe(false);
  });
});

describe("shouldSkipAdminScheduledTasksBffProxyForTaskRunPost", () => {
  it("returns true only for POST /api/admin/tasks/{taskId}/run", () => {
    expect(
      shouldSkipAdminScheduledTasksBffProxyForTaskRunPost(
        new Request("http://test/api/admin/tasks/507f1f77bcf86cd799439011/run", { method: "POST" })
      )
    ).toBe(true);
    expect(
      shouldSkipAdminScheduledTasksBffProxyForTaskRunPost(
        new Request("http://test/api/admin/tasks/507f1f77bcf86cd799439011/run/", { method: "POST" })
      )
    ).toBe(true);
    expect(
      shouldSkipAdminScheduledTasksBffProxyForTaskRunPost(
        new Request("http://test/api/admin/tasks", { method: "POST" })
      )
    ).toBe(false);
    expect(
      shouldSkipAdminScheduledTasksBffProxyForTaskRunPost(
        new Request("http://test/api/admin/tasks/abc/run", { method: "GET" })
      )
    ).toBe(false);
    expect(
      shouldSkipAdminScheduledTasksBffProxyForTaskRunPost(
        new Request("http://test/api/admin/scheduler/tick", { method: "POST" })
      )
    ).toBe(false);
  });
});

describe("proxyAdminScheduledTasksRequestToBackend — Next-only GET + task run skip", () => {
  it("returns null for GET task-runs when BFF gate is on (hub window parity)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    vi.stubEnv("ATXFINANCE_BFF_PROXY_LOOPBACK", "1");

    const res = await proxyAdminScheduledTasksRequestToBackend(
      new Request("http://test/api/admin/task-runs?window=24h&status=failed", { method: "GET" })
    );
    expect(res).toBeNull();
  });
});

describe("proxyAdminScheduledTasksRequestToBackend — task run skip", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
    delete process.env.ATXFINANCE_BFF_PROXY_LOOPBACK;
  });

  it("returns null for POST task run when BFF gate is on (Next executes Yahoo scanners)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    vi.stubEnv("ATXFINANCE_BFF_PROXY_LOOPBACK", "1");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(true);

    const res = await proxyAdminScheduledTasksRequestToBackend(
      new Request("http://test/api/admin/tasks/task_1/run", { method: "POST" })
    );
    expect(res).toBeNull();
  });
});
