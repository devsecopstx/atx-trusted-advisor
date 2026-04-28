import { describe, expect, it } from "vitest";

import {
    clearMarketingPostingOAuthRuntimeCaches,
    getValidAccessTokenForMarketingPosting
} from "@/modules/marketing/x-posting-token-manager";

describe("x-posting-token-manager", () => {
  it("returns null when client credentials missing", async () => {
    clearMarketingPostingOAuthRuntimeCaches();
    const prevId = process.env.X_OAUTH_CLIENT_ID;
    const prevSecret = process.env.X_OAUTH_CLIENT_SECRET;
    delete process.env.X_OAUTH_CLIENT_ID;
    delete process.env.X_OAUTH_CLIENT_SECRET;
    await expect(getValidAccessTokenForMarketingPosting()).resolves.toBeNull();
    process.env.X_OAUTH_CLIENT_ID = prevId;
    process.env.X_OAUTH_CLIENT_SECRET = prevSecret;
  });
});
