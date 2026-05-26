import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("/xchat workspace shell contract", () => {
  const pageSrc = readFileSync(join(process.cwd(), "src/app/xchat/page.tsx"), "utf8");
  const loadingSrc = readFileSync(join(process.cwd(), "src/app/xchat/loading.tsx"), "utf8");
  const layoutSrc = readFileSync(join(process.cwd(), "src/app/xchat/layout.tsx"), "utf8");
  const approvedShellSrc = readFileSync(join(process.cwd(), "src/app/xchat/xchat-approved-shell.tsx"), "utf8");
  const conversationSrc = readFileSync(join(process.cwd(), "src/app/xchat/ui/xchat-conversation.tsx"), "utf8");

  it("locks layout root + uses sticky workspace chrome (no page-level footer after body for signed-in)", () => {
    expect(layoutSrc).toContain("xchat-layout-root");
    expect(layoutSrc).toContain("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden");
    expect(pageSrc).toContain("workspace-product-sticky-top");
    expect(pageSrc).toContain("workspace-product-approved-header-slot");
    expect(pageSrc).not.toContain("</div>\n      <GlobalFooter />");
    expect(approvedShellSrc).toContain("<WorkspaceProductLegalFooter />");
    expect(conversationSrc).toContain("mainFooter");
    expect(conversationSrc).toContain("{mainFooter}");
    expect(loadingSrc).not.toContain("GlobalFooter");
    expect(pageSrc).not.toContain("GlobalFooter");
    expect(pageSrc).not.toContain("WorkspaceProductLegalFooter");
  });

  it("scopes main chat column with tenant chrome classes", () => {
    expect(conversationSrc).toContain("portfolios-workspace-tenant-chrome");
    expect(conversationSrc).toContain("xchat-tenant-chrome");
  });

  it("puts welcome + tenant in sticky approved header; desk meta bar holds outlook + usage", () => {
    expect(pageSrc).toContain("welcomeName={appUserPrimaryDisplayName(session)}");
    expect(conversationSrc).toContain("xchat-desk-meta-bar");
    expect(conversationSrc).not.toContain("xchat-welcome-header--compact");
    expect(approvedShellSrc).toContain("initialOutlookDesk={initialOutlookDesk}");
    expect(conversationSrc).toContain("<XchatOutlookFreshnessBadge");
    expect(conversationSrc).toContain("<XchatUsageMeter");
  });
});
