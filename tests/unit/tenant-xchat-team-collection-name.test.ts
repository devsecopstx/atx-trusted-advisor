import { describe, expect, it } from "vitest";

import { buildTenantXchatAttachmentsCollectionName } from "@/modules/platform/tenant-xchat-team-collection";

describe("buildTenantXchatAttachmentsCollectionName", () => {
  it("uses stable prefix and slug suffix", () => {
    expect(buildTenantXchatAttachmentsCollectionName("acme-corp")).toBe(
      "xfinance-tenant-acme-corp-xchat-attachments"
    );
  });

  it("normalizes messy slugs", () => {
    expect(buildTenantXchatAttachmentsCollectionName("Acme_Corp!!")).toBe(
      "xfinance-tenant-acme-corp-xchat-attachments"
    );
  });
});
