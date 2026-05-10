import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("xChat thread rendering regression contract", () => {
  const conversation = readFileSync(join(process.cwd(), "src/app/xchat/ui/xchat-conversation.tsx"), "utf8");
  const bubble = readFileSync(join(process.cwd(), "src/app/xchat/ui/xchat-thread-message-bubble.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "src/app/xchat/xchat.css"), "utf8");

  it("keeps latest turn paired by collapsing earlier history to compact cap", () => {
    expect(conversation).toContain("const XCHAT_UI_VISIBLE_MESSAGE_CAP = 6;");
    expect(conversation).toContain("setThreadHistoryExpanded(false);");
  });

  it("renders formatted Options Action Scan card only when structured rows exist", () => {
    expect(bubble).toContain("const hasScanRows = Boolean(msg.optionsActionScan && msg.optionsActionScan.rows.length > 0);");
    expect(bubble).toContain("msg.optionsActionScan ? (");
    expect(bubble).toContain("hasScanRows ? (");
    expect(bubble).toContain("<OptionsActionScanReportLazy");
    expect(bubble).toContain(": hasAssistantText ? (");
    expect(bubble).toContain("No content received from advisor for this scan.");
  });

  it("pins user prompt bubble text sizing/alignment to latest-prompt scale", () => {
    expect(css).toContain(".xchat-msg-user-body--with-image");
    expect(css).toContain(".xchat-msg-user-body__text");
    expect(css).toContain("font-size: 0.72rem;");
    expect(css).toContain("line-height: 1.3;");
    expect(css).toContain("padding-top: 0.5rem;");
    expect(css).toContain("padding-bottom: 0.5rem;");
  });
});
