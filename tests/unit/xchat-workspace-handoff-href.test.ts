import { describe, expect, it } from "vitest";

import { xchatWorkspaceHandoffHref } from "@/lib/xchat/xchat-workspace-handoff-href";

describe("xchatWorkspaceHandoffHref", () => {
  it("returns base path without portfolio", () => {
    expect(xchatWorkspaceHandoffHref("/xoptions", null)).toBe("/xoptions");
    expect(xchatWorkspaceHandoffHref("/xstrategybuilder", undefined)).toBe("/xstrategybuilder");
  });

  it("appends portfolioId query for workspace scope", () => {
    expect(xchatWorkspaceHandoffHref("/xoptions", "507f1f77bcf86cd799439011")).toBe(
      "/xoptions?portfolioId=507f1f77bcf86cd799439011"
    );
  });
});
