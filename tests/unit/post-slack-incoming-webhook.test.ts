import { describe, expect, it, vi } from "vitest";

import {
  isSlackIncomingWebhookUrl,
  postSlackIncomingWebhook,
} from "@/lib/post-slack-incoming-webhook";

describe("isSlackIncomingWebhookUrl", () => {
  it("accepts hooks.slack.com https URLs", () => {
    expect(
      isSlackIncomingWebhookUrl("https://hooks.slack.com/services/T00/B00/xx")
    ).toBe(true);
  });

  it("rejects non-Slack hosts", () => {
    expect(isSlackIncomingWebhookUrl("https://evil.example/hook")).toBe(false);
  });

  it("rejects non-https", () => {
    expect(isSlackIncomingWebhookUrl("http://hooks.slack.com/services/x")).toBe(false);
  });
});

describe("postSlackIncomingWebhook", () => {
  it("returns false for invalid URL without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const ok = await postSlackIncomingWebhook("https://example.com/x", { text: "hi" });
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("posts JSON and returns true on 200", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    const url = "https://hooks.slack.com/services/T/B/x";
    const ok = await postSlackIncomingWebhook(url, { text: "hello" });
    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hello" }),
      })
    );
    fetchSpy.mockRestore();
  });
});
