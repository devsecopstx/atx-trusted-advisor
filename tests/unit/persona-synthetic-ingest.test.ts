import { describe, expect, it } from "vitest";

import {
    buildSyntheticPersonaDocFromIngestedFile,
    shouldOfferSyntheticPersonaFromIngest
} from "@/modules/xchat/persona-spec-text";

describe("shouldOfferSyntheticPersonaFromIngest", () => {
  it("allows seed-style names ending in _yaml", () => {
    expect(
      shouldOfferSyntheticPersonaFromIngest({
        fileName: "xpersonas__wheel__wheel_yaml",
        contentType: "text/plain"
      })
    ).toBe(true);
  });

  it("blocks pdf", () => {
    expect(
      shouldOfferSyntheticPersonaFromIngest({
        fileName: "doc.pdf",
        contentType: "application/pdf"
      })
    ).toBe(false);
  });
});

describe("buildSyntheticPersonaDocFromIngestedFile", () => {
  it("builds friendly title name from ingest path (no file-id suffix)", () => {
    const r = buildSyntheticPersonaDocFromIngestedFile({
      sourceLabel: "xai:t",
      fileId: "file_94847856-a56f-4b1e-82dd-7fe0b3af43d9",
      displayFileName: "xpersonas__wheel__wheel_yaml",
      text: "1234567890\n\nPlain strategy body for xChat."
    });
    expect("error" in r).toBe(false);
    if ("error" in r) {
      return;
    }
    expect(r.doc.name).toBe("Wheel");
    expect(String(r.doc.system_prompt).length).toBeGreaterThanOrEqual(10);
  });
});
