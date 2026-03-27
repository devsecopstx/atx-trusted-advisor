import { describe, expect, it } from "vitest";

import { extractClientLoginMeta } from "@/lib/client-request-meta";

describe("extractClientLoginMeta", () => {
  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const req = new Request("https://example.com/cb", {
      headers: {
        "x-forwarded-for": "10.0.0.1, 192.168.1.1",
        "cf-connecting-ip": "203.0.113.5"
      }
    });
    expect(extractClientLoginMeta(req).clientIp).toBe("203.0.113.5");
  });

  it("uses first x-forwarded-for when cf-connecting-ip absent", () => {
    const req = new Request("https://example.com/cb", {
      headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" }
    });
    expect(extractClientLoginMeta(req).clientIp).toBe("198.51.100.2");
  });

  it("reads cf-ipcountry when valid", () => {
    const req = new Request("https://example.com/cb", {
      headers: { "cf-ipcountry": "de" }
    });
    expect(extractClientLoginMeta(req).country).toBe("DE");
  });

  it("ignores cf-ipcountry XX", () => {
    const req = new Request("https://example.com/cb", {
      headers: { "cf-ipcountry": "XX" }
    });
    expect(extractClientLoginMeta(req).country).toBeUndefined();
  });

  it("truncates user-agent", () => {
    const longUa = "a".repeat(400);
    const req = new Request("https://example.com/cb", {
      headers: { "user-agent": longUa }
    });
    expect(extractClientLoginMeta(req).userAgent?.length).toBe(256);
  });
});
