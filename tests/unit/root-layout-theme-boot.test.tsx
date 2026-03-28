import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RootLayout from "@/app/layout";

describe("RootLayout theme boot script", () => {
  it("renders the xf theme bootstrap script in head", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );

    expect(html).toContain("<head><script id=\"xf-ui-theme-boot\">");
    expect(html).toContain("localStorage.getItem(\"xf-ui-theme\")");
    expect(html).toContain("<body><div>content</div></body>");
  });
});
