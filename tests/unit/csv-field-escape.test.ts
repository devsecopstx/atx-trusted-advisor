import { describe, expect, it } from "vitest";

import { escapeCsvField } from "@/lib/csv-field-escape";

describe("escapeCsvField", () => {
  it("leaves simple tokens unchanged", () => {
    expect(escapeCsvField("TSLA")).toBe("TSLA");
  });

  it("wraps and escapes quotes and commas", () => {
    expect(escapeCsvField('say "hi", ok')).toBe('"say ""hi"", ok"');
  });

  it("normalizes CRLF to LF inside quoted output", () => {
    expect(escapeCsvField("a\r\nb")).toBe('"a\nb"');
  });
});
