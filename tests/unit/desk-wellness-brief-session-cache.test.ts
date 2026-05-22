import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    deskWellnessLocationKey,
    readDeskWellnessWeatherSessionCache,
    writeDeskWellnessWeatherSessionCache
} from "@/lib/desk-wellness-brief-session-cache";

describe("desk-wellness-brief-session-cache", () => {
  const store = new Map<string, string>();

  const sessionStoragePolyfill = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", sessionStoragePolyfill);
    vi.stubGlobal("window", { sessionStorage: sessionStoragePolyfill });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips weather for today and location bucket", () => {
    const key = deskWellnessLocationKey(30.27, -97.74);
    expect(key).toBe("30.3,-97.7");
    writeDeskWellnessWeatherSessionCache(key, "Mostly sunny, 82°F.");
    expect(readDeskWellnessWeatherSessionCache(key)).toBe("Mostly sunny, 82°F.");
  });

  it("misses when location bucket differs", () => {
    writeDeskWellnessWeatherSessionCache("default", "Austin haze.");
    expect(readDeskWellnessWeatherSessionCache("30.3,-97.7")).toBeNull();
  });
});
