import { describe, expect, it } from "vitest";

import { maskAccountXrefForDisplay } from "@/lib/account-xref-display";

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
