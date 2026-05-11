import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import type { AuditEvent } from "@/modules/audit/types";
import { bootstrapAuditEventsToCsv } from "@/modules/platform/tenant-bootstrap-audit-csv";

function ev(partial: Partial<AuditEvent> & Pick<AuditEvent, "createdAt">): AuditEvent {
  return {
    entityType: "tenant",
    entityId: "507f1f77bcf86cd799439022",
    action: "tenant_provision_bootstrap",
    actor: { userId: "64a1b2c3d4e5f678901234aa" },
    ...partial
  };
}

describe("bootstrapAuditEventsToCsv", () => {
  it("writes header and escapes commas/quotes/newlines", () => {
    const createdAt = new Date("2026-05-01T12:00:00.000Z");
    const csv = bootstrapAuditEventsToCsv([
      ev({
        createdAt,
        actor: { userId: "u1", email: 'say "hi"' },
        details: {
          trigger: "oauth_login",
          platformRole: "operator",
          success: true,
          portfolioId: "abc",
          error: 'bad, error with "quotes"\nand newline tail'
        }
      })
    ]);
    expect(csv.startsWith("createdAt,actorUserId,")).toBe(true);
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain('"bad, error with ""quotes""');
  });

  it("truncates error snippet to 500 chars", () => {
    const longErr = "x".repeat(600);
    const csv = bootstrapAuditEventsToCsv([
      ev({
        createdAt: new Date(),
        details: { error: longErr }
      })
    ]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    const cols = (lines[1] ?? "").split(",");
    expect(cols[cols.length - 1]).toBe("x".repeat(500));
    expect(csv).not.toContain("x".repeat(501));
  });

  it("handles empty optional fields", () => {
    const csv = bootstrapAuditEventsToCsv([
      ev({
        _id: new ObjectId(),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        details: {}
      })
    ]);
    expect(csv.split("\r\n")[1]?.split(",")).toHaveLength(8);
  });
});
