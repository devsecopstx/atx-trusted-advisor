import type React from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter", className: "inter-mock" })
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/app/ui/app-query-provider", () => ({
  AppQueryProvider: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock("@/lib/identity-shell-cache", () => ({
  getTenantXfUiThemePreferenceForHexCached: vi.fn().mockResolvedValue(undefined),
  getTenantShellBrandingForHexCached: vi.fn().mockResolvedValue(null),
  getCoreUserXfUiThemePreferenceForHexCached: vi.fn().mockResolvedValue(undefined)
}));

import RootLayout, { metadata } from "@/app/layout";

async function readableStreamToHtml(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      out += decoder.decode(value, { stream: true });
    }
  }
  out += decoder.decode();
  return out;
}

describe("RootLayout theme boot", () => {
  it("uses the app PWA hero icon for metadata.icons", () => {
    const icons = metadata.icons;
    expect(icons).toBeTruthy();
    expect(typeof icons).toBe("object");
    expect(Array.isArray(icons)).toBe(false);

    if (!icons || typeof icons === "string" || icons instanceof URL || Array.isArray(icons)) {
      throw new Error("Unexpected metadata.icons shape");
    }

    expect(icons.icon).toBe("/pwa/atx-logo-512.png");
    expect(icons.shortcut).toBe("/pwa/atx-logo-512.png");
  });

  it("does not render inline script tags in layout markup", async () => {
    const stream = await renderToReadableStream(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    const html = await readableStreamToHtml(stream);

    expect(html).not.toContain("xf-ui-theme-boot");
    expect(html).toMatch(/<body[^>]*>[\s\S]*<div>content<\/div>[\s\S]*<\/body>/);
  });
});
