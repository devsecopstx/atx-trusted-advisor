import { describe, expect, it } from "vitest";

import {
    disambiguateSyncedPersonaDisplayName,
    friendlyDisplayNameForSyncedXpersona,
    friendlyStemFromXaiIngestFileName,
    yamlNameLooksLikeIngestPath
} from "@/modules/xchat/persona-spec-text";

describe("friendlyStemFromXaiIngestFileName", () => {
  it("strips xpersonas apex and _yaml suffix", () => {
    expect(friendlyStemFromXaiIngestFileName("xpersonas__wheel__wheel_yaml")).toBe("wheel");
  });

  it("dedupes repeated folder/file stem", () => {
    expect(
      friendlyStemFromXaiIngestFileName("xpersonas__marriage_planner__marriage_planner_advisor_yaml")
    ).toBe("marriage_planner_advisor");
  });

  it("strips finance_reference_docs apex", () => {
    expect(
      friendlyStemFromXaiIngestFileName("finance_reference_docs__wheel__wheel_yaml")
    ).toBe("wheel");
  });
});

describe("friendlyDisplayNameForSyncedXpersona", () => {
  it("title-cases stem from ingest file name when yaml name is ingest-shaped", () => {
    expect(
      friendlyDisplayNameForSyncedXpersona({
        yamlName: "xpersonas__legal__legal_advisor_yaml",
        fileName: "xpersonas__legal__legal_advisor_yaml",
        fileId: "file_abc"
      })
    ).toBe("Legal Advisor");
  });

  it("preserves intentional spaced / mixed-case YAML names", () => {
    expect(
      friendlyDisplayNameForSyncedXpersona({
        yamlName: "Series 7 Coach",
        fileName: "xpersonas__exam__exam_yaml",
        fileId: "file_x"
      })
    ).toBe("Series 7 Coach");
  });

  it("title-cases clean kebab yaml slug", () => {
    expect(
      friendlyDisplayNameForSyncedXpersona({
        yamlName: "atx-trusted-advisor",
        fileName: "ignored_yaml",
        fileId: "file_y"
      })
    ).toBe("Atx Trusted Advisor");
  });
});

describe("yamlNameLooksLikeIngestPath", () => {
  it("detects double-underscore paths", () => {
    expect(yamlNameLooksLikeIngestPath("xpersonas__a__b")).toBe(true);
  });

  it("allows plain slugs", () => {
    expect(yamlNameLooksLikeIngestPath("marriage-planner-advisor")).toBe(false);
  });
});

describe("disambiguateSyncedPersonaDisplayName", () => {
  it("appends short id tail within 80 chars", () => {
    const out = disambiguateSyncedPersonaDisplayName("Wheel", "file_94847856-a56f-4b1e-82dd-7fe0b3af43d9");
    expect(out.startsWith("Wheel ")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out).toContain("af43d9");
  });
});
