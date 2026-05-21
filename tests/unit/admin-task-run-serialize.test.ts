import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { serializeAdminTaskRunForJson } from "@/lib/admin-scheduled-task-serialize";
import type { TaskRun } from "@/modules/core-admin/types";

describe("serializeAdminTaskRunForJson", () => {
  it("serializes ids and timestamps for admin task runs API", () => {
    const started = new Date("2026-05-20T12:00:00.000Z");
    const completed = new Date("2026-05-20T12:00:05.000Z");
    const run: TaskRun = {
      _id: new ObjectId("507f1f77bcf86cd799439099"),
      tenantId: new ObjectId("507f1f77bcf86cd799439022"),
      taskId: new ObjectId("507f1f77bcf86cd799439033"),
      taskName: "sync-broker-job",
      category: "sync-broker",
      triggeredBy: "scheduler",
      status: "failed",
      startedAt: started,
      completedAt: completed,
      durationMs: 5000,
      output: "tenant=507f1f77bcf86cd799439022\nBroker sync failed: timeout",
      executor: {
        runtime: "next",
        environment: "local",
        label: "Next · local · dev-host",
        service: "atxfinance-core-app"
      }
    };

    const json = serializeAdminTaskRunForJson(run);
    expect(json._id).toBe("507f1f77bcf86cd799439099");
    expect(json.taskId).toBe("507f1f77bcf86cd799439033");
    expect(json.startedAt).toBe(started.toISOString());
    expect(json.completedAt).toBe(completed.toISOString());
    expect(json.output).toContain("Broker sync failed");
    expect(json.executor?.label).toBe("Next · local · dev-host");
    expect(json.executor?.runtime).toBe("next");
  });
});
