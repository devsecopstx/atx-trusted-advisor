import { describe, expect, it } from "vitest";

import { brokerExportRefMatchesStoredExt } from "@/lib/broker-account-ref-match";

describe("brokerExportRefMatchesStoredExt", () => {
  it("matches exact and trimmed", () => {
    expect(brokerExportRefMatchesStoredExt("12345678", "12345678")).toBe(true);
    expect(brokerExportRefMatchesStoredExt(" 12345678 ", "12345678")).toBe(true);
  });

  it("matches case-insensitive alphanumeric", () => {
    expect(brokerExportRefMatchesStoredExt("Ab12", "ab12")).toBe(true);
  });

  it("matches when punctuation differs but digits are equal", () => {
    expect(brokerExportRefMatchesStoredExt("12-34-5678", "12345678")).toBe(true);
  });

  it("matches last-4 from export to full stored number", () => {
    expect(brokerExportRefMatchesStoredExt("5678", "12345678")).toBe(true);
    expect(brokerExportRefMatchesStoredExt("5678", "0012345678")).toBe(true);
  });

  it("does not match wrong last 4", () => {
    expect(brokerExportRefMatchesStoredExt("5678", "12341234")).toBe(false);
  });

  it("does not match when both are 4 digits but different", () => {
    expect(brokerExportRefMatchesStoredExt("5678", "1234")).toBe(false);
  });

  it("matches two equal 4-digit accounts", () => {
    expect(brokerExportRefMatchesStoredExt("5678", "5678")).toBe(true);
  });
});
