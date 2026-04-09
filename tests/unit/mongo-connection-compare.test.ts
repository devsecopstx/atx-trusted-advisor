import { describe, expect, it } from "vitest";

import {
    isDockerComposeLoopbackVsServiceSkew,
    mongoFingerprintStrictEqual,
    parseMongoFingerprintLabel
} from "@/lib/mongo-connection-compare";

describe("mongo-connection-compare", () => {
  it("parseMongoFingerprintLabel splits host:port and database", () => {
    expect(parseMongoFingerprintLabel("127.0.0.1:27017/atxfinance")).toEqual({
      hostWithPort: "127.0.0.1:27017",
      database: "atxfinance"
    });
    expect(parseMongoFingerprintLabel("mongodb:27017/atxfinance")).toEqual({
      hostWithPort: "mongodb:27017",
      database: "atxfinance"
    });
  });

  it("mongoFingerprintStrictEqual normalizes case and trailing slashes", () => {
    expect(mongoFingerprintStrictEqual("127.0.0.1:27017/atxfinance", "127.0.0.1:27017/atxfinance")).toBe(true);
    expect(mongoFingerprintStrictEqual("127.0.0.1:27017/atxfinance/", "127.0.0.1:27017/atxfinance")).toBe(true);
    expect(mongoFingerprintStrictEqual("mongodb:27017/atxfinance", "127.0.0.1:27017/atxfinance")).toBe(false);
  });

  it("isDockerComposeLoopbackVsServiceSkew detects localhost vs mongodb service with same db", () => {
    expect(
      isDockerComposeLoopbackVsServiceSkew("127.0.0.1:27017/atxfinance", "mongodb:27017/atxfinance")
    ).toBe(true);
    expect(
      isDockerComposeLoopbackVsServiceSkew("localhost:27017/atxfinance", "mongodb:27017/atxfinance")
    ).toBe(true);
    expect(
      isDockerComposeLoopbackVsServiceSkew("mongodb:27017/atxfinance", "127.0.0.1:27017/atxfinance")
    ).toBe(true);
    expect(
      isDockerComposeLoopbackVsServiceSkew("127.0.0.1:27017/atxfinance", "127.0.0.1:27017/otherdb")
    ).toBe(false);
    expect(
      isDockerComposeLoopbackVsServiceSkew("127.0.0.1:27017/atxfinance", "127.0.0.1:27018/atxfinance")
    ).toBe(false);
  });
});
