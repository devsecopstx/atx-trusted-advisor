import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn(() => ({
    PUBLIC_APP_BASE_URL: undefined
  }))
}));

import { resolvePublicAppOrigin, shouldRejectPublicLinkOrigin } from "@/lib/public-app-origin";

describe("shouldRejectPublicLinkOrigin", () => {
  it("rejects bind-all and loopback hosts", () => {
    expect(shouldRejectPublicLinkOrigin("http://0.0.0.0:8080")).toBe(true);
    expect(shouldRejectPublicLinkOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(shouldRejectPublicLinkOrigin("http://localhost:3000")).toBe(true);
    expect(shouldRejectPublicLinkOrigin("http://[::]:8080")).toBe(true);
  });

  it("allows normal public HTTPS origins", () => {
    expect(shouldRejectPublicLinkOrigin("https://atxtrustedadvisory.com")).toBe(false);
    expect(shouldRejectPublicLinkOrigin("https://example.run.app")).toBe(false);
  });
});

describe("resolvePublicAppOrigin", () => {
  it("falls back to default when request URL uses 0.0.0.0", async () => {
    const { getEnv } = await import("@/lib/env");
    vi.mocked(getEnv).mockReturnValue({
      PUBLIC_APP_BASE_URL: undefined
    } as ReturnType<typeof getEnv>);

    const req = new Request("http://0.0.0.0:8080/api/admin/access-requests/x");
    expect(resolvePublicAppOrigin(req)).toBe("https://atxtrustedadvisory.com");
  });

  it("uses PUBLIC_APP_BASE_URL when valid", async () => {
    const { getEnv } = await import("@/lib/env");
    vi.mocked(getEnv).mockReturnValue({
      PUBLIC_APP_BASE_URL: "https://apps.example.com"
    } as ReturnType<typeof getEnv>);

    const req = new Request("http://0.0.0.0:8080/api/test");
    expect(resolvePublicAppOrigin(req)).toBe("https://apps.example.com");
  });

  it("ignores invalid PUBLIC_APP_BASE_URL (0.0.0.0) and falls back", async () => {
    const { getEnv } = await import("@/lib/env");
    vi.mocked(getEnv).mockReturnValue({
      PUBLIC_APP_BASE_URL: "http://0.0.0.0:8080"
    } as ReturnType<typeof getEnv>);

    const req = new Request("http://0.0.0.0:8080/api/test");
    expect(resolvePublicAppOrigin(req)).toBe("https://atxtrustedadvisory.com");
  });
});
