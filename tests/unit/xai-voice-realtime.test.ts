import { beforeEach, describe, expect, it, vi } from "vitest";

const getEnvMock = vi.hoisted(() =>
  vi.fn(() => ({
    XAI_API_KEY: "test-key",
    XAI_BASE_URL: "https://api.x.ai/v1" as string | undefined
  }))
);

vi.mock("@/lib/env", () => ({
  getEnv: () => getEnvMock(),
  XAI_BASE_URL_DEFAULT: "https://api.x.ai/v1"
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  buildXaiRealtimeWsUrl,
  createXaiRealtimeClientSecret
} from "@/lib/xai-voice-realtime";

describe("xai-voice-realtime", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getEnvMock.mockReturnValue({
      XAI_API_KEY: "test-key",
      XAI_BASE_URL: "https://api.x.ai/v1"
    });
  });

  describe("buildXaiRealtimeWsUrl", () => {
    it("uses XAI_BASE_URL_DEFAULT when XAI_BASE_URL is unset", () => {
      getEnvMock.mockReturnValue({
        XAI_API_KEY: "test-key",
        XAI_BASE_URL: undefined
      });
      expect(buildXaiRealtimeWsUrl("grok-voice-think-fast-1.0")).toBe(
        "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0"
      );
    });

    it("honors custom XAI_BASE_URL", () => {
      getEnvMock.mockReturnValue({
        XAI_API_KEY: "test-key",
        XAI_BASE_URL: "https://edge.example.test/v1"
      });
      expect(buildXaiRealtimeWsUrl("grok-voice-fast-1.0")).toBe(
        "wss://edge.example.test/v1/realtime?model=grok-voice-fast-1.0"
      );
    });
  });

  describe("createXaiRealtimeClientSecret", () => {
    it("POSTs client_secrets and clamps expires seconds", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ value: "xai-realtime-secret", expires_at: 1_700_000_000 })
      });
      const r = await createXaiRealtimeClientSecret({
        expiresSeconds: 9000,
        model: "grok-voice-think-fast-1.0"
      });
      expect(r.value).toBe("xai-realtime-secret");
      expect(r.expires_at).toBe(1_700_000_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.x.ai/v1/realtime/client_secrets");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        expires_after: { seconds: 3600 },
        session: { model: "grok-voice-think-fast-1.0" }
      });
    });

    it("throws when XAI_API_KEY is missing", async () => {
      getEnvMock.mockReturnValue({
        XAI_API_KEY: "",
        XAI_BASE_URL: "https://api.x.ai/v1"
      });
      await expect(
        createXaiRealtimeClientSecret({
          expiresSeconds: 300,
          model: "grok-voice-think-fast-1.0"
        })
      ).rejects.toThrow(/missing_xai_api_key/);
    });

    it("throws on non-OK upstream response", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ message: "upstream_down" })
      });
      await expect(
        createXaiRealtimeClientSecret({
          expiresSeconds: 300,
          model: "grok-voice-think-fast-1.0"
        })
      ).rejects.toThrow(/xai_realtime_client_secret:/);
    });
  });
});
