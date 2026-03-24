import { describe, expect, it } from "vitest";

import { XAI_BASE_URL_DEFAULT, XAI_MANAGEMENT_BASE_URL_DEFAULT } from "@/lib/env";

describe("xAI URL defaults", () => {
  it("XAI_BASE_URL_DEFAULT is the canonical xAI API base URL", () => {
    expect(XAI_BASE_URL_DEFAULT).toBe("https://api.x.ai/v1");
  });

  it("XAI_MANAGEMENT_BASE_URL_DEFAULT is the canonical xAI Management API base URL", () => {
    expect(XAI_MANAGEMENT_BASE_URL_DEFAULT).toBe("https://management-api.x.ai/v1");
  });
});
