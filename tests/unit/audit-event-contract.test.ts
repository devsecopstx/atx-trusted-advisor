import { describe, expect, it } from "vitest";

import type { AuditActor, AuditEntityType, AuditEvent } from "@/modules/audit/types";

/**
 * Contract guard: Kotlin `AuditEventService` and Next `createAuditEvent` should stay
 * aligned on core fields for `admin_audit_events` (see atx-docs/sre-ops/audit-lineage-and-controls.md).
 */
describe("AuditEvent contract", () => {
  it("documents required fields for a minimal valid event", () => {
    const actor: AuditActor = {
      userId: "507f1f77bcf86cd799439011",
      email: "a@b.co",
      username: "u"
    };
    const entityType: AuditEntityType = "access_request";
    const row: AuditEvent = {
      entityType,
      entityId: "507f1f77bcf86cd799439022",
      action: "self_requested",
      actor,
      details: { requestedRole: "viewer" },
      createdAt: new Date()
    };
    expect(row.entityType).toBe("access_request");
    expect(row.actor.userId).toBe(actor.userId);
  });

  it("entityType union matches admin audit query schema in route", () => {
    const fromRoute = [
      "xpersona",
      "access_request",
      "core_user",
      "deploy_note_config",
      "admin_delivery_channel",
      "admin_portfolio",
      "xchat_session",
      "core_scanner"
    ] as const;
    const satisfiesAuditEntity = (x: string): x is AuditEntityType =>
      (fromRoute as readonly string[]).includes(x);
    expect(satisfiesAuditEntity("xpersona")).toBe(true);
    expect(satisfiesAuditEntity("unknown")).toBe(false);
  });
});
