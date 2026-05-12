import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("/xchat workspace shell contract", () => {
  const pageSrc = readFileSync(join(process.cwd(), "src/app/xchat/page.tsx"), "utf8");
  const layoutSrc = readFileSync(join(process.cwd(), "src/app/xchat/layout.tsx"), "utf8");
  const approvedShellSrc = readFileSync(join(process.cwd(), "src/app/xchat/xchat-approved-shell.tsx"), "utf8");
  const conversationSrc = readFileSync(join(process.cwd(), "src/app/xchat/ui/xchat-conversation.tsx"), "utf8");

  it("locks layout root + uses sticky workspace chrome (no page-level footer after body for signed-in)", () => {
    expect(layoutSrc).toContain("xchat-layout-root");
    expect(layoutSrc).toContain("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden");
    expect(pageSrc).toContain("workspace-product-sticky-top");
    expect(pageSrc).toContain("workspace-product-approved-header-slot");
    expect(pageSrc).not.toContain("</div>\n      <GlobalFooter />");
    expect(approvedShellSrc).toContain("mainFooter={<GlobalFooter />}");
    expect(conversationSrc).toContain("mainFooter");
    expect(conversationSrc).toContain("{mainFooter}");
  });

  it("seeds desk outlook through the approved shell into the welcome header row", () => {
    expect(approvedShellSrc).toContain("initialOutlookDesk={initialOutlookDesk}");
    expect(approvedShellSrc).not.toContain("<XchatOutlookDeskFreshnessLabel desk={initialOutlookDesk} />");
    expect(conversationSrc).toContain("initialOutlookDesk?: XchatInitialOutlookDesk | null");
    expect(conversationSrc).toContain('className="xchat-welcome-header__row"');
    expect(conversationSrc).toContain("<XchatOutlookDeskFreshnessLabel desk={initialOutlookDesk} inline />");
  });
});
