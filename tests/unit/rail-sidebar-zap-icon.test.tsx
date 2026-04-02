import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";

describe("RailSidebarZapIcon", () => {
  it("renders lightning polygon and toggle size classes", () => {
    const html = renderToStaticMarkup(<RailSidebarZapIcon size="toggle" />);
    expect(html).toContain("xf-rail-sidebar-zap-icon--toggle");
    expect(html).toContain("13 2 3 14 12 14 11 22 21 10 12 10 13 2");
  });

  it("renders disclosure size class", () => {
    const html = renderToStaticMarkup(<RailSidebarZapIcon size="disclosure" />);
    expect(html).toContain("xf-rail-sidebar-zap-icon--disclosure");
  });
});
