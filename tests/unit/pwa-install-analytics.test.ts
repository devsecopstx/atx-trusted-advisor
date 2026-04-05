import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    PWA_INSTALL_ANALYTICS_EVENT,
    trackPwaInstallEvent
} from "@/lib/pwa-install-analytics";

describe("trackPwaInstallEvent", () => {
  const dispatchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("window", {
      dispatchEvent: dispatchSpy
    } as unknown as Window & typeof globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    dispatchSpy.mockReset();
  });

  it("dispatches analytics custom events with detail payload", () => {
    trackPwaInstallEvent("pwa_install_prompt_shown", {
      surface: "manual",
      ios: false
    });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const evt = dispatchSpy.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(evt?.type).toBe(PWA_INSTALL_ANALYTICS_EVENT);
    expect(evt?.detail).toMatchObject({
      eventName: "pwa_install_prompt_shown",
      metadata: { surface: "manual", ios: false }
    });
    expect(typeof evt?.detail?.timestamp).toBe("number");
  });
});
