import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    XAI_API_KEY: "test-key",
    XAI_BASE_URL: "https://api.x.ai/v1",
    XAI_MANAGEMENT_API_KEY: "mgmt",
    X_OAUTH_CLIENT_ID: "id",
    X_OAUTH_CLIENT_SECRET: "sec"
  })
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { transcribeAudioWithXaiStt } from "@/lib/xai-stt";

describe("transcribeAudioWithXaiStt", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("POSTs multipart to /v1/stt and parses text", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ text: "buy TSLA calls", duration: 3.21, language: "English" })
    });
    const file = new File([Buffer.from("fake-audio")], "rec.webm", { type: "audio/webm" });
    const r = await transcribeAudioWithXaiStt({ file, language: "en" });
    expect(r.text).toBe("buy TSLA calls");
    expect(r.duration).toBe(3.21);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer test-key" });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws on non-OK response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: "rate_limited" })
    });
    const file = new File([Buffer.from("x")], "a.webm", { type: "audio/webm" });
    await expect(transcribeAudioWithXaiStt({ file })).rejects.toThrow(/xai_stt:/);
  });
});
