import { describe, expect, it } from "vitest";

import { assertValidXfHeroIconUrl } from "@/lib/tenant-hero-icon-url";

describe("assertValidXfHeroIconUrl", () => {
  it("accepts https URLs", () => {
    expect(assertValidXfHeroIconUrl("  https://cdn.example.com/a.png  ")).toBe("https://cdn.example.com/a.png");
  });

  it("accepts loopback http", () => {
    expect(assertValidXfHeroIconUrl("http://127.0.0.1:3000/icon.png")).toBe("http://127.0.0.1:3000/icon.png");
    expect(assertValidXfHeroIconUrl("http://localhost/foo.svg")).toBe("http://localhost/foo.svg");
  });

  it("rejects non-loopback http", () => {
    expect(() => assertValidXfHeroIconUrl("http://evil.com/x.png")).toThrow(/https/);
  });

  it("accepts png data URL with base64", () => {
    const s = "data:image/png;base64,iVBORw0KGgo=";
    expect(assertValidXfHeroIconUrl(s)).toBe(s);
  });

  it("rejects unknown data URL type", () => {
    expect(() => assertValidXfHeroIconUrl("data:text/plain;base64,AA")).toThrow(/image\/png|jpeg|webp|gif|svg/);
  });
});
