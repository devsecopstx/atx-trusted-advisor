import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter", className: "inter-mock" })
}));

import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout theme boot", () => {
  it("uses the same browser icon as the rail swirl mark", () => {
    const icons = metadata.icons;
    expect(icons).toBeTruthy();
    expect(typeof icons).toBe("object");
    expect(Array.isArray(icons)).toBe(false);

    if (!icons || typeof icons === "string" || icons instanceof URL || Array.isArray(icons)) {
      throw new Error("Unexpected metadata.icons shape");
    }

    expect(icons.icon).toBe("/branding/aTx.png");
    expect(icons.shortcut).toBe("/branding/aTx.png");
  });

  it("does not render inline script tags in layout markup", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );

    expect(html).not.toContain("xf-ui-theme-boot");
    expect(html).toContain("<body><div>content</div></body>");
  });
});
