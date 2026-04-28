import { describe, expect, it } from "vitest";

import * as about from "@/app/resources/about/page";
import * as buildingWheel from "@/app/resources/building-wheel/page";
import * as wheelVsIc from "@/app/resources/building-wheel/wheel-vs-iron-condor/page";
import * as cashSecuredPutsMastery from "@/app/resources/cash-secured-puts-mastery/page";
import * as coveredCalls2026 from "@/app/resources/covered-calls-2026-balanced-income/page";
import * as decision from "@/app/resources/decision-workflow/page";
import * as fromXchatToBrokerIbkr from "@/app/resources/from-xchat-to-broker-ibkr/page";
import * as gettingStarted from "@/app/resources/getting-started/page";
import * as grokWheelEdge from "@/app/resources/how-xai-spots-better-wheels/page";
import * as leapOptionsPlaybook from "@/app/resources/leap-options-playbook/page";
import * as multiPortfolioHnwi from "@/app/resources/multi-portfolio-management-hnwi/page";
import * as optionsRiskFrameworks from "@/app/resources/options-risk-management-frameworks/page";
import * as secret from "@/app/resources/secret-sauce/page";

function expectMetadata(module: unknown) {
  expect(module as Record<string, unknown>).toHaveProperty("metadata");
  const m = (module as { metadata?: { title?: unknown } }).metadata;
  expect(m).toBeTruthy();
  expect(typeof m!.title).toBe("string");
  expect((m!.title as string).length).toBeGreaterThan(0);
}

describe("Resources pages exports for public/SEO delivery", () => {
  it("export revalidate=3600 and metadata on all resources pages", () => {
    const modules = [
      about,
      decision,
      secret,
      gettingStarted,
      buildingWheel,
      wheelVsIc,
      grokWheelEdge,
      cashSecuredPutsMastery,
      coveredCalls2026,
      leapOptionsPlaybook,
      multiPortfolioHnwi,
      optionsRiskFrameworks,
      fromXchatToBrokerIbkr,
    ] as const;
    for (const mod of modules) {
      expect(mod).toHaveProperty("revalidate");
      expect((mod as { revalidate?: unknown }).revalidate).toBe(3600);
      expectMetadata(mod);
    }
  });
});
