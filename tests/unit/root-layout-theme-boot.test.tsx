import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter", className: "inter-mock" })
}));

import RootLayout from "@/app/layout";

describe("RootLayout theme boot", () => {
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
