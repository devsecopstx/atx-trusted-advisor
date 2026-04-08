import { describe, expect, it } from "vitest";

import {
    canonicalMongoObjectIdHex,
    isLikelyMongoObjectIdHex,
    normalizeMongoObjectIdParam,
    redactMongoObjectIdForSidebarPreview,
    tenantIdHexLastFourUserFacing
} from "@/lib/mongo-object-id-hex";

describe("canonicalMongoObjectIdHex", () => {
  it("lowercases 24-char hex", () => {
    expect(canonicalMongoObjectIdHex("69C44A5EA186DA234DB395F4")).toBe("69c44a5ea186da234db395f4");
  });

  it("leaves non-hex strings unchanged (trim only)", () => {
    expect(canonicalMongoObjectIdHex("  abc  ")).toBe("abc");
  });
});

describe("normalizeMongoObjectIdParam", () => {
  it("lowercases 24-char hex and trims", () => {
    expect(normalizeMongoObjectIdParam(" 69C44A5EA186DA234DB395F4 ")).toBe("69c44a5ea186da234db395f4");
  });

  it("returns trimmed non-hex as-is", () => {
    expect(normalizeMongoObjectIdParam("  foo  ")).toBe("foo");
  });
});

describe("isLikelyMongoObjectIdHex", () => {
  it("is true for 24 hex chars", () => {
    expect(isLikelyMongoObjectIdHex("69c44a5ea186da234db395f4")).toBe(true);
  });

  it("is false for wrong length", () => {
    expect(isLikelyMongoObjectIdHex("69c44a5ea186da234db395f")).toBe(false);
  });
});

describe("tenantIdHexLastFourUserFacing", () => {
  it("shows ellipsis plus last four lowercase hex for ObjectId", () => {
    expect(tenantIdHexLastFourUserFacing("69D50DF9A37FF7959BCD87C0")).toBe("···87c0");
  });

  it("returns empty for blank", () => {
    expect(tenantIdHexLastFourUserFacing("  ")).toBe("");
  });
});

describe("redactMongoObjectIdForSidebarPreview", () => {
  it("redacts 24-char ObjectId hex", () => {
    expect(redactMongoObjectIdForSidebarPreview("69c44a5ea186da234db395f4")).toBe("69c4…95f4");
  });

  it("returns empty for blank", () => {
    expect(redactMongoObjectIdForSidebarPreview("  ")).toBe("");
  });
});
