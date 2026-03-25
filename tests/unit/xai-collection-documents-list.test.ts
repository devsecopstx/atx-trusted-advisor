import { describe, expect, it } from "vitest";

import { parseXaiCollectionDocumentsListPayload } from "@/lib/xai";

describe("parseXaiCollectionDocumentsListPayload", () => {
  it("reads file_id and name from nested file_metadata (xAI list documents response)", () => {
    const page = parseXaiCollectionDocumentsListPayload({
      documents: [
        {
          file_metadata: {
            file_id: "file_aaa",
            name: "xpersonas__foo__bar_yaml",
            content_type: "text/plain"
          },
          status: "DOCUMENT_STATUS_PROCESSED"
        }
      ],
      pagination_token: ""
    });
    expect(page.entries).toEqual([
      { fileId: "file_aaa", name: "xpersonas__foo__bar_yaml", contentType: "text/plain" }
    ]);
    expect(page.nextPaginationToken).toBeUndefined();
  });

  it("omits nextPaginationToken when token is absent", () => {
    const page = parseXaiCollectionDocumentsListPayload({
      documents: [
        {
          file_metadata: {
            file_id: "file_b",
            name: "b.md"
          }
        }
      ]
    });
    expect(page.entries).toHaveLength(1);
    expect(page.nextPaginationToken).toBeUndefined();
  });

  it("returns pagination_token for next page", () => {
    const page = parseXaiCollectionDocumentsListPayload({
      documents: [{ file_metadata: { file_id: "file_c", name: "c.yaml" } }],
      pagination_token: "next-page-token"
    });
    expect(page.nextPaginationToken).toBe("next-page-token");
  });

  it("supports legacy flat rows (top-level file_id)", () => {
    const page = parseXaiCollectionDocumentsListPayload({
      documents: [{ file_id: "file_legacy", name: "legacy.yaml" }]
    });
    expect(page.entries).toEqual([{ fileId: "file_legacy", name: "legacy.yaml" }]);
  });
});
