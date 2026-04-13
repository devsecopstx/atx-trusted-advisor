import { describe, it, expect } from "vitest";

import * as about from "@/app/resources/about/page";
import * as decision from "@/app/resources/decision-workflow/page";
import * as secret from "@/app/resources/secret-sauce/page";
import * as gettingStarted from "@/app/resources/getting-started/page";
import * as buildingWheel from "@/app/resources/building-wheel/page";
import * as wheelVsIc from "@/app/resources/building-wheel/wheel-vs-iron-condor/page";

function expectMetadata(module: unknown) {
  expect(module as Record<string, unknown>).toHaveProperty("metadata");
  const m = (module as { metadata?: { title?: unknown } }).metadata;
  expect(m).toBeTruthy();
  expect(typeof m!.title).toBe("string");
  expect((m!.title as string).length).toBeGreaterThan(0);
}

describe("Resources pages exports for public/SEO delivery", () => {
  it("export revalidate=3600 and metadata on all resources pages", () => {
    const modules = [about, decision, secret, gettingStarted, buildingWheel, wheelVsIc] as const;
    for (const mod of modules) {
      expect(mod).toHaveProperty("revalidate");
      expect((mod as { revalidate?: unknown }).revalidate).toBe(3600);
      expectMetadata(mod);
    }
  });
});
