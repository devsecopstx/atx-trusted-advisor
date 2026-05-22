import { afterEach, describe, expect, it } from "vitest";

import {
    deskWellnessLocationKey,
    readDeskWellnessWeatherSessionCache,
    writeDeskWellnessWeatherSessionCache
} from "@/lib/desk-wellness-brief-session-cache";

describe("desk-wellness-brief-session-cache", () => {
  afterEach(() => {
    sessionStorage.clear();
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
