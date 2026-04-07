import { describe, expect, it } from "vitest";

import {
    isProvisioningPortfolioAccountRef,
    maskAccountXrefForDisplay
} from "@/lib/account-xref-display";

describe("maskAccountXrefForDisplay", () => {
  it("returns em dash for empty", () => {
    expect(maskAccountXrefForDisplay("")).toBe("—");
    expect(maskAccountXrefForDisplay("   ")).toBe("—");
    expect(maskAccountXrefForDisplay(null)).toBe("—");
  });

  it("hides short refs entirely", () => {
    expect(maskAccountXrefForDisplay("ab")).toBe("••••");
    expect(maskAccountXrefForDisplay("1234")).toBe("••••");
  });

  it("shows last four only for longer refs", () => {
    expect(maskAccountXrefForDisplay("Z06276930")).toBe("••••6930");
    expect(maskAccountXrefForDisplay("ext_account_xref")).toBe("••••xref");
  });
});

describe("isProvisioningPortfolioAccountRef", () => {
  it("treats empty, default seed ref, and atx- ids as provisioning", () => {
    expect(isProvisioningPortfolioAccountRef("")).toBe(true);
    expect(isProvisioningPortfolioAccountRef("   ")).toBe(true);
    expect(isProvisioningPortfolioAccountRef("fidelity-default-account")).toBe(true);
    expect(isProvisioningPortfolioAccountRef("atx-abc123def456")).toBe(true);
  });

  it("treats user-set refs as non-provisioning", () => {
    expect(isProvisioningPortfolioAccountRef("Z06276930")).toBe(false);
    expect(isProvisioningPortfolioAccountRef("ext_account_xref")).toBe(false);
  });
});
