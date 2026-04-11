import { describe, expect, it } from "vitest";

import { normalizeXaiFileProcessingStatus } from "@/lib/xai";

describe("normalizeXaiFileProcessingStatus", () => {
  it("treats missing status as pending", () => {
    expect(normalizeXaiFileProcessingStatus(undefined)).toBe("pending");
    expect(normalizeXaiFileProcessingStatus(null)).toBe("pending");
  });

  it("maps vendor aliases", () => {
    expect(normalizeXaiFileProcessingStatus("COMPLETED")).toBe("complete");
    expect(normalizeXaiFileProcessingStatus("in progress")).toBe("processing");
    expect(normalizeXaiFileProcessingStatus("queued")).toBe("pending");
    expect(normalizeXaiFileProcessingStatus("error")).toBe("failed");
  });

  it("returns unknown for unrecognized strings", () => {
    expect(normalizeXaiFileProcessingStatus("weird_state")).toBe("unknown");
    expect(normalizeXaiFileProcessingStatus(42)).toBe("unknown");
  });
});
