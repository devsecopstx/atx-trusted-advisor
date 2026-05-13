import { describe, expect, it } from "vitest";

import { listBffRegisteredWriteDispositions } from "@/lib/data-plane-write-health";

describe("listBffRegisteredWriteDispositions", () => {
  it("treats personas BFF registry writes as Spring when BFF gate is on", () => {
    const rows = listBffRegisteredWriteDispositions();
    const personaWrites = rows.filter((r) => r.pathTemplate.startsWith("/api/personas"));
    expect(personaWrites.length).toBeGreaterThan(0);
    for (const r of personaWrites) {
      expect(r.disposition).toBe("spring_when_bff_gate_on");
      expect(r.reason).toBeUndefined();
    }
    expect(personaWrites.some((r) => r.method === "POST" && r.pathTemplate === "/api/personas")).toBe(true);
    expect(
      personaWrites.some((r) => r.method === "PUT" && r.pathTemplate === "/api/personas/{personaId}")
    ).toBe(true);
    expect(
      personaWrites.some((r) => r.method === "DELETE" && r.pathTemplate === "/api/personas/{personaId}")
    ).toBe(true);
  });

  it("treats admin scheduled-task registry writes as Spring when BFF gate is on", () => {
    const rows = listBffRegisteredWriteDispositions();
    const taskWrites = rows.filter(
      (r) => r.pathTemplate.startsWith("/api/admin/tasks") || r.pathTemplate === "/api/admin/scheduler/tick"
    );
    expect(taskWrites.length).toBeGreaterThan(0);
    for (const r of taskWrites) {
      expect(r.disposition).toBe("spring_when_bff_gate_on");
      expect(r.reason).toBeUndefined();
    }
    expect(taskWrites.some((r) => r.method === "POST" && r.pathTemplate === "/api/admin/tasks")).toBe(true);
    expect(taskWrites.some((r) => r.method === "PATCH" && r.pathTemplate === "/api/admin/tasks/{taskId}")).toBe(
      true
    );
    expect(taskWrites.some((r) => r.method === "DELETE" && r.pathTemplate === "/api/admin/tasks/{taskId}")).toBe(
      true
    );
    expect(
      taskWrites.some((r) => r.method === "POST" && r.pathTemplate === "/api/admin/tasks/{taskId}/run")
    ).toBe(true);
    expect(taskWrites.some((r) => r.method === "POST" && r.pathTemplate === "/api/admin/scheduler/tick")).toBe(true);
  });

  it("treats POST /api/xchat/ask/stream as Spring when BFF gate is on (static registry)", () => {
    const rows = listBffRegisteredWriteDispositions();
    const stream = rows.find((r) => r.method === "POST" && r.pathTemplate === "/api/xchat/ask/stream");
    expect(stream).toBeDefined();
    expect(stream!.disposition).toBe("spring_when_bff_gate_on");
    expect(stream!.reason).toBeUndefined();
  });
});
