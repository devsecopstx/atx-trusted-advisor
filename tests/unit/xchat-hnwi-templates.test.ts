import { describe, expect, it } from "vitest";

import {
    filterXchatPromptTemplates,
    XCHAT_HNWI_PROMPT_TEMPLATES
} from "@/modules/xchat/xchat-hnwi-templates";

describe("filterXchatPromptTemplates", () => {
  it("returns all templates when query empty", () => {
    expect(filterXchatPromptTemplates(XCHAT_HNWI_PROMPT_TEMPLATES, "")).toHaveLength(
      XCHAT_HNWI_PROMPT_TEMPLATES.length
    );
  });

  it("filters by title substring", () => {
    const out = filterXchatPromptTemplates(XCHAT_HNWI_PROMPT_TEMPLATES, "priority pass");
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("watchlist-update");
  });

  it("filters by prompt body", () => {
    const out = filterXchatPromptTemplates(XCHAT_HNWI_PROMPT_TEMPLATES, "vol spike");
    expect(out.length).toBeGreaterThanOrEqual(1);
  });
});
