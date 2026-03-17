import { describe, expect, it } from "vitest";

import {
  canTransition,
  checkAccessRequestPolicy,
  computeExpiry,
  isExpired,
  isTerminalStatus
} from "@/modules/core-admin/access-policy";
import { ACCESS_REQUEST_SLA_DAYS } from "@/modules/core-admin/types";

describe("access request policy checks", () => {
  it("passes for a valid new viewer request", () => {
    const violations = checkAccessRequestPolicy({
      requestedRole: "viewer",
      requestedPlan: "free",
      currentRoles: [],
      tenantId: "tenant_1"
    });
    expect(violations).toHaveLength(0);
  });

  it("rejects when user already has the requested role", () => {
    const violations = checkAccessRequestPolicy({
      requestedRole: "viewer",
      requestedPlan: "free",
      currentRoles: ["viewer"]
    });
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe("ALREADY_HAS_ROLE");
  });

  it("rejects global_admin self-service downgrade", () => {
    const violations = checkAccessRequestPolicy({
      requestedRole: "viewer",
      requestedPlan: "free",
      currentRoles: ["global_admin"]
    });
    expect(violations.some((v) => v.code === "ADMIN_CANNOT_DOWNGRADE")).toBe(true);
  });

  it("rejects advisor on free plan", () => {
    const violations = checkAccessRequestPolicy({
      requestedRole: "advisor",
      requestedPlan: "free",
      currentRoles: []
    });
    expect(violations.some((v) => v.code === "ADVISOR_REQUIRES_PAID_PLAN")).toBe(true);
  });

  it("allows advisor on pro plan", () => {
    const violations = checkAccessRequestPolicy({
      requestedRole: "advisor",
      requestedPlan: "pro",
      currentRoles: []
    });
    expect(violations).toHaveLength(0);
  });

  it("rejects enterprise plan with viewer role", () => {
    const violations = checkAccessRequestPolicy({
      requestedRole: "viewer",
      requestedPlan: "enterprise",
      currentRoles: []
    });
    expect(violations.some((v) => v.code === "ENTERPRISE_REQUIRES_ELEVATED_ROLE")).toBe(true);
  });

  it("allows enterprise plan with advisor role", () => {
    const violations = checkAccessRequestPolicy({
      requestedRole: "advisor",
      requestedPlan: "enterprise",
      currentRoles: []
    });
    expect(violations).toHaveLength(0);
  });
});

describe("access request state machine", () => {
  it("allows new → triaged", () => {
    expect(canTransition("new", "triaged")).toBe(true);
  });

  it("allows new → approved", () => {
    expect(canTransition("new", "approved")).toBe(true);
  });

  it("allows new → rejected", () => {
    expect(canTransition("new", "rejected")).toBe(true);
  });

  it("allows new → expired", () => {
    expect(canTransition("new", "expired")).toBe(true);
  });

  it("allows triaged → pending", () => {
    expect(canTransition("triaged", "pending")).toBe(true);
  });

  it("allows triaged → approved", () => {
    expect(canTransition("triaged", "approved")).toBe(true);
  });

  it("allows pending → approved", () => {
    expect(canTransition("pending", "approved")).toBe(true);
  });

  it("allows pending → rejected", () => {
    expect(canTransition("pending", "rejected")).toBe(true);
  });

  it("rejects approved → pending (terminal)", () => {
    expect(canTransition("approved", "pending")).toBe(false);
  });

  it("rejects rejected → approved (terminal)", () => {
    expect(canTransition("rejected", "approved")).toBe(false);
  });

  it("rejects expired → approved (terminal)", () => {
    expect(canTransition("expired", "approved")).toBe(false);
  });

  it("identifies terminal statuses", () => {
    expect(isTerminalStatus("approved")).toBe(true);
    expect(isTerminalStatus("rejected")).toBe(true);
    expect(isTerminalStatus("expired")).toBe(true);
    expect(isTerminalStatus("new")).toBe(false);
    expect(isTerminalStatus("triaged")).toBe(false);
    expect(isTerminalStatus("pending")).toBe(false);
  });
});

describe("access request SLA expiry", () => {
  it("computes expiry as requestedAt + SLA days", () => {
    const requestedAt = new Date("2026-03-10T00:00:00Z");
    const expiry = computeExpiry(requestedAt);
    const expected = new Date("2026-03-10T00:00:00Z");
    expected.setDate(expected.getDate() + ACCESS_REQUEST_SLA_DAYS);
    expect(expiry.toISOString()).toBe(expected.toISOString());
  });

  it("isExpired returns false before SLA", () => {
    const requestedAt = new Date("2026-03-10T00:00:00Z");
    const now = new Date("2026-03-12T00:00:00Z");
    expect(isExpired(requestedAt, now)).toBe(false);
  });

  it("isExpired returns true after SLA", () => {
    const requestedAt = new Date("2026-03-01T00:00:00Z");
    const now = new Date("2026-03-20T00:00:00Z");
    expect(isExpired(requestedAt, now)).toBe(true);
  });
});
