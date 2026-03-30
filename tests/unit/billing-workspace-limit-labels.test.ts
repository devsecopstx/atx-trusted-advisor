import { describe, expect, it } from "vitest";

import {
    BILLING_WORKSPACE_LABEL_XCHAT,
    BILLING_WORKSPACE_LABEL_XOPTIONS,
    BILLING_WORKSPACE_LIMIT_SPECS
} from "@/lib/billing-plan-workspace-display";

describe("billing workspace limit labels (Account → Billing)", () => {
  it("exports canonical hourly labels without per-day wording", () => {
    expect(BILLING_WORKSPACE_LABEL_XOPTIONS).toBe("xOptions views / hr");
    expect(BILLING_WORKSPACE_LABEL_XCHAT).toBe("xChat prompts / hr");
    expect(BILLING_WORKSPACE_LABEL_XOPTIONS.toLowerCase()).not.toContain("day");
    expect(BILLING_WORKSPACE_LABEL_XCHAT.toLowerCase()).not.toContain("day");
  });

  it("BILLING_WORKSPACE_LIMIT_SPECS mirrors exports for xOptions and xChat rows", () => {
    expect(BILLING_WORKSPACE_LIMIT_SPECS[0]?.label).toBe(BILLING_WORKSPACE_LABEL_XOPTIONS);
    expect(BILLING_WORKSPACE_LIMIT_SPECS[1]?.label).toBe(BILLING_WORKSPACE_LABEL_XCHAT);
  });
});
