import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
    DELIVERY_CHANNELS_TABS,
    parseDeliveryChannelsTab
} from "@/app/admin/delivery-channels/delivery-channels-tabs";
import {
    ADMIN_FUNCTION_GROUPS,
    ADMIN_PLATFORM_OPS_ITEMS,
    getAdminRailPrimaryItems
} from "@/app/admin/ui/admin-hub-sections";

describe("admin hub sections", () => {
  it("uses four hub groups without People & access or Developer & integration", () => {
    const titles = ADMIN_FUNCTION_GROUPS.map((g) => g.title);
    expect(titles).toEqual([
      "Books & custody",
      "Desk & operations",
      "AI & knowledge",
      "Platform & compliance"
    ]);
    expect(titles).not.toContain("People & access");
    expect(titles).not.toContain("Developer & integration");
  });

  it("places Manage users first under Desk & operations", () => {
    const desk = ADMIN_FUNCTION_GROUPS.find((g) => g.title === "Desk & operations");
    expect(desk?.items[0]?.href).toBe("/admin/manage-users");
    expect(desk?.items.some((i) => i.href === "/admin/delivery-channels")).toBe(true);
    expect(desk?.items.some((i) => i.href === "/admin/tasks")).toBe(true);
  });

  it("exposes five primary rail shortcuts", () => {
    const hrefs = getAdminRailPrimaryItems().map((i) => i.href);
    expect(hrefs).toEqual([
      "/admin/portfolios",
      "/admin/manage-users",
      "/admin/tasks",
      "/admin/personas",
      "/admin/tenant-preferences"
    ]);
  });

  it("moves audit and usage links to platform ops rail disclosure", () => {
    const platform = ADMIN_FUNCTION_GROUPS.find((g) => g.title === "Platform & compliance");
    expect(platform?.items.some((i) => i.href === "/admin/audit")).toBe(false);
    expect(ADMIN_PLATFORM_OPS_ITEMS.some((i) => i.href === "/admin/audit")).toBe(true);
    expect(ADMIN_PLATFORM_OPS_ITEMS.some((i) => i.href === "/admin/xchat-tool-usage")).toBe(true);
  });

  it("documents developer harnesses on delivery channels hub item", () => {
    const desk = ADMIN_FUNCTION_GROUPS.find((g) => g.title === "Desk & operations");
    const channels = desk?.items.find((i) => i.href === "/admin/delivery-channels");
    expect(channels?.description).toMatch(/xChat API test/i);
    expect(channels?.description).toMatch(/xOptions API test/i);
    const hubSource = readFileSync(
      path.join(process.cwd(), "src/app/admin/ui/admin-hub-sections.ts"),
      "utf8"
    );
    expect(hubSource).not.toContain('href: "/admin/xchat-api-test"');
  });
});

describe("admin delivery channels tabs", () => {
  it("parses tab query param with channels default", () => {
    expect(parseDeliveryChannelsTab(undefined)).toBe("channels");
    expect(parseDeliveryChannelsTab("xchat-api")).toBe("xchat-api");
    expect(parseDeliveryChannelsTab("bogus")).toBe("channels");
  });

  it("includes developer harness tabs", () => {
    const ids = DELIVERY_CHANNELS_TABS.map((t) => t.id);
    expect(ids).toEqual(["channels", "xoptions", "xchat-api", "test-post-x"]);
  });

  it("legacy admin routes redirect to delivery channels tabs", () => {
    expect(readFileSync(path.join(process.cwd(), "src/app/admin/xoptions/page.tsx"), "utf8")).toContain(
      "?tab=xoptions"
    );
    expect(
      readFileSync(path.join(process.cwd(), "src/app/admin/xchat-api-test/page.tsx"), "utf8")
    ).toContain("?tab=xchat-api");
    expect(readFileSync(path.join(process.cwd(), "src/app/admin/test-post-x/page.tsx"), "utf8")).toContain(
      "?tab=test-post-x"
    );
  });
});
