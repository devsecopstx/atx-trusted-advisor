import { describe, expect, it } from "vitest";

import { toXaiSttLanguage } from "@/lib/xai-stt-lang";

describe("toXaiSttLanguage", () => {
  it("maps en locales to en", () => {
    expect(toXaiSttLanguage("en-US")).toBe("en");
    expect(toXaiSttLanguage("en_GB")).toBe("en");
  });

  it("maps ISO locales with hyphen", () => {
    expect(toXaiSttLanguage("fr-FR")).toBe("fr");
    expect(toXaiSttLanguage("de")).toBe("de");
  });

  it("defaults short invalid input to en", () => {
    expect(toXaiSttLanguage("")).toBe("en");
    expect(toXaiSttLanguage("x")).toBe("en");
  });
});
