import { describe, expect, it } from "vitest";

import { getXaiFinanceCollectionId } from "@/lib/xai-finance-collection";
import { resolveXchatPersonaDeclaredCollectionIds } from "@/modules/xchat/persona-linked-collections";
import { shouldPinFinanceCollectionForMessage } from "@/modules/xchat/xchat-ask-routing";

describe("canonical Finance collection routing", () => {
  it("pins finance/options asks to the Finance collection id", () => {
    expect(shouldPinFinanceCollectionForMessage("scan my covered calls on TSLA")).toBe(true);
    expect(shouldPinFinanceCollectionForMessage("hello")).toBe(false);
  });

  it("defaults persona collection scope to Finance when unset", () => {
    expect(resolveXchatPersonaDeclaredCollectionIds({})).toEqual([getXaiFinanceCollectionId()]);
  });
});
