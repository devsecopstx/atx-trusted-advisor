import { describe, expect, it } from "vitest";

import {
    BILLING_WORKSPACE_LABEL_XCHAT_DAILY,
    BILLING_WORKSPACE_LABEL_XCHAT_HOURLY,
    BILLING_WORKSPACE_LABEL_XOPTIONS,
    BILLING_WORKSPACE_LIMIT_SPECS
} from "@/lib/billing-plan-workspace-display";

describe("billing workspace limit labels (Account → Billing)", () => {
  it("exports canonical UTC hour + day labels for xChat", () => {
    expect(BILLING_WORKSPACE_LABEL_XOPTIONS).toBe("xOptions views / hr");
    expect(BILLING_WORKSPACE_LABEL_XCHAT_HOURLY).toBe("xChat prompts / hr (UTC)");
    expect(BILLING_WORKSPACE_LABEL_XCHAT_DAILY).toBe("xChat prompts / day (UTC)");
    expect(BILLING_WORKSPACE_LABEL_XCHAT_HOURLY.toLowerCase()).toContain("utc");
    expect(BILLING_WORKSPACE_LABEL_XCHAT_DAILY.toLowerCase()).toContain("day");
  });

  it("BILLING_WORKSPACE_LIMIT_SPECS order: xOptions, xChat hourly, xChat daily, portfolios, accounts", () => {
    expect(BILLING_WORKSPACE_LIMIT_SPECS[0]?.label).toBe(BILLING_WORKSPACE_LABEL_XOPTIONS);
    expect(BILLING_WORKSPACE_LIMIT_SPECS[1]?.label).toBe(BILLING_WORKSPACE_LABEL_XCHAT_HOURLY);
    expect(BILLING_WORKSPACE_LIMIT_SPECS[2]?.label).toBe(BILLING_WORKSPACE_LABEL_XCHAT_DAILY);
  });
});
