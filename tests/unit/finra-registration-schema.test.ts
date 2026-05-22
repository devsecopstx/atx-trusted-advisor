import { describe, expect, it } from "vitest";

import {
    finraRegistrationFieldsSchema,
    normalizeOptionalEvidenceUrl
} from "@/modules/compliance/finra-registration-schema";

describe("finraRegistrationFieldsSchema", () => {
  it("accepts registration with invalid optional evidence URL coerced to null", () => {
    const parsed = finraRegistrationFieldsSchema.safeParse({
      crdNumber: "123456",
      licenseType: "series_65",
      jurisdiction: "NY",
      evidenceUrl: "not-a-valid-url",
      notes: null,
      status: "active"
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.evidenceUrl).toBeNull();
    }
  });

  it("accepts empty evidence URL when credential files are uploaded separately", () => {
    const parsed = finraRegistrationFieldsSchema.safeParse({
      crdNumber: "123456",
      licenseType: "series_7",
      jurisdiction: "ca",
      evidenceUrl: "",
      notes: "",
      status: "active"
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.evidenceUrl).toBeNull();
      expect(parsed.data.jurisdiction).toBe("CA");
      expect(parsed.data.notes).toBeNull();
    }
  });

  it("preserves valid https evidence URLs", () => {
    expect(normalizeOptionalEvidenceUrl("https://example.com/credential.pdf")).toBe(
      "https://example.com/credential.pdf"
    );
  });
});
