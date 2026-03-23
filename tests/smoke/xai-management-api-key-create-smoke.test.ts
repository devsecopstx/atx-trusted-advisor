import { describe, expect, it } from "vitest";

const shouldRun = process.env.RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE === "true";
const maybeIt = shouldRun ? it : it.skip;

describe("xAI management api-key create smoke", () => {
  maybeIt("creates team API key via management API", async () => {
    const teamId = process.env.XAI_TEAM_ID?.trim();
    const managementApiKey = process.env.XAI_MANAGEMENT_API_KEY?.trim();
    const managementBaseUrl = (
      process.env.XAI_MANAGEMENT_ROOT_URL?.trim() ?? "https://management-api.x.ai"
    ).replace(/\/$/, "");

    if (!teamId) {
      throw new Error("Missing XAI_TEAM_ID for management key-create smoke test");
    }
    if (teamId.startsWith("collection_")) {
      throw new Error(
        "XAI_TEAM_ID looks like a KB collection id (collection_*). Key-create smoke posts to /auth/teams/{teamUuid}/api-keys — use your xAI team UUID for this run, or omit RUN_XAI_MANAGEMENT_KEY_CREATE_SMOKE."
      );
    }
    if (!managementApiKey) {
      throw new Error("Missing XAI_MANAGEMENT_API_KEY for management key-create smoke test");
    }

    const keyName = `atxfinance-smoke-${Date.now()}`;
    const response = await fetch(`${managementBaseUrl}/auth/teams/${teamId}/api-keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: keyName,
        acls: ["api-key:model:*", "api-key:endpoint:*"],
        qps: 3,
        qpm: 10,
        tpm: null
      })
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        `xAI management key-create failed (${response.status}): ${JSON.stringify(payload)}`
      );
    }

    const createdName =
      (typeof payload.name === "string" ? payload.name : undefined) ??
      (typeof payload.api_key_name === "string" ? payload.api_key_name : undefined);
    const createdId =
      (typeof payload.id === "string" ? payload.id : undefined) ??
      (typeof payload.api_key_id === "string" ? payload.api_key_id : undefined);

    expect(createdName).toBeTruthy();
    expect(createdName).toContain("atxfinance-smoke-");
    expect(createdId).toBeTruthy();
  });
});
