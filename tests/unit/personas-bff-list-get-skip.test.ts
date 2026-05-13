import { describe, expect, it } from "vitest";

import { shouldSkipPersonasBffProxyForPersonasListGet } from "@/lib/backend-bff";

describe("shouldSkipPersonasBffProxyForPersonasListGet", () => {
  it("skips BFF for GET /api/personas only (xChat persona picker)", () => {
    expect(
      shouldSkipPersonasBffProxyForPersonasListGet(new Request("http://localhost/api/personas"))
    ).toBe(true);
    expect(
      shouldSkipPersonasBffProxyForPersonasListGet(new Request("http://localhost/api/personas/"))
    ).toBe(true);
  });

  it("does not skip POST /api/personas", () => {
    expect(
      shouldSkipPersonasBffProxyForPersonasListGet(
        new Request("http://localhost/api/personas", { method: "POST" })
      )
    ).toBe(false);
  });

  it("does not skip GET /api/personas/{id}", () => {
    expect(
      shouldSkipPersonasBffProxyForPersonasListGet(
        new Request("http://localhost/api/personas/507f1f77bcf86cd799439011")
      )
    ).toBe(false);
  });
});
