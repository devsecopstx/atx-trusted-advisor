import { describe, expect, it } from "vitest";

import { buildDeskNotificationEmailPreviewHtml } from "@/lib/desk-notification-email-preview";

describe("buildDeskNotificationEmailPreviewHtml", () => {
  it("escapes HTML and embeds event copy", () => {
    const html = buildDeskNotificationEmailPreviewHtml([
      { title: "Alert <test>", body: "Line1\n<script>", symbol: "FOO" }
    ]);
    expect(html).toContain("Alert &lt;test&gt;");
    expect(html).toContain("FOO");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("aTx⚡Finance");
  });
});
