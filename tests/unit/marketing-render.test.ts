import { describe, expect, it } from "vitest";

import {
    MANDATORY_MARKETING_DISCLAIMER,
    renderMarketingPost,
    stripStandaloneDuplicateDestinationUrls
} from "@/modules/marketing/render";

describe("stripStandaloneDuplicateDestinationUrls", () => {
  it("removes bare destination URLs on their own lines", () => {
    const body = "Hello\n\nhttps://atxtrustedadvisory.com\n";
    expect(stripStandaloneDuplicateDestinationUrls(body, "https://atxtrustedadvisory.com")).toBe("Hello");
  });

  it("removes standalone URL lines that duplicate tracking params host", () => {
    const body = "Copy\nhttps://atxtrustedadvisory.com/?utm_source=x&utm_campaign=weekly-pulse";
    expect(stripStandaloneDuplicateDestinationUrls(body, "https://atxtrustedadvisory.com")).toBe("Copy");
  });

  it("keeps lines that are not bare URLs", () => {
    const body = "See https://atxtrustedadvisory.com/plans for more.";
    expect(stripStandaloneDuplicateDestinationUrls(body, "https://atxtrustedadvisory.com")).toBe(body);
  });
});

describe("renderMarketingPost", () => {
  it("uses one tracked URL line and text-only disclaimer", () => {
    const { postText, finalUrl } = renderMarketingPost({
      sourceContent: "x",
      config: {
        destinationUrl: "https://atxtrustedadvisory.com",
        utmParams: {
          utm_source: "x",
          utm_campaign: "weekly-pulse",
          utm_medium: "owned-social"
        }
      },
      generatedMarkdown: "Title\n\nhttps://atxtrustedadvisory.com\n"
    });

    expect(finalUrl).toContain("utm_source=x");
    const urlLines = postText.split("\n").filter((line) => /^https?:\/\//i.test(line.trim()));
    expect(urlLines).toHaveLength(1);
    expect(urlLines[0]).toContain("utm_source=x");
    expect(postText.endsWith(MANDATORY_MARKETING_DISCLAIMER)).toBe(true);
    expect(MANDATORY_MARKETING_DISCLAIMER).not.toMatch(/^https?:\/\//);
  });
});
