import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readXchatThreadCss } from "../helpers/read-xchat-stylesheet";

describe("xChat outlook desk freshness label contract", () => {
  const labelSrc = readFileSync(
    join(process.cwd(), "src/app/xchat/ui/xchat-outlook-desk-freshness-label.tsx"),
    "utf8"
  );
  const cssSrc = readXchatThreadCss();

  it("supports inline welcome-row rendering without standalone shell margin", () => {
    expect(labelSrc).toContain("inline?: boolean");
    expect(labelSrc).toContain("xchat-outlook-freshness-badge--welcome-row");
    expect(cssSrc).toContain(".xchat-outlook-freshness-badge--welcome-row");
    expect(cssSrc).toContain(".xchat-welcome-header__row");
  });
});
