import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    ONBOARDING_CHECKLIST_STEPS,
    ONBOARDING_CHECKLIST_TOTAL_STEPS,
    getNextOnboardingStep,
} from "@/lib/onboarding/onboarding-checklist-steps";
import {
    buildOnboardingChecklistStorageKey,
    parseOnboardingChecklistState,
    toggleOnboardingStepCompletion,
} from "@/lib/onboarding/onboarding-checklist-storage";

describe("onboarding checklist steps", () => {
  it("defines seven foundations with action bullets and CTAs", () => {
    expect(ONBOARDING_CHECKLIST_TOTAL_STEPS).toBe(7);
    for (const step of ONBOARDING_CHECKLIST_STEPS) {
      expect(step.actions.length).toBeGreaterThan(0);
      expect(step.actions.length).toBeLessThanOrEqual(4);
      expect(step.cta.href.startsWith("/")).toBe(true);
      expect(step.familyOfficeNote.length).toBeGreaterThan(20);
      expect(step.impactLine.length).toBeGreaterThan(10);
    }
  });

  it("chains next foundation for advance navigation", () => {
    expect(getNextOnboardingStep("portfolio-foundation")?.id).toBe("watchlist-curation");
    expect(getNextOnboardingStep("expected-outcome")).toBeNull();
  });
});

describe("onboarding checklist storage", () => {
  const store = new Map<string, string>();
  const localStoragePolyfill = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", { localStorage: localStoragePolyfill });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scopes storage key by user id when present", () => {
    expect(buildOnboardingChecklistStorageKey(null)).toContain("xf_onboarding_checklist_v1");
    expect(buildOnboardingChecklistStorageKey("abc123")).toContain("abc123");
  });

  it("parses persisted completion state safely", () => {
    expect(parseOnboardingChecklistState(null).completedStepIds).toEqual([]);
    expect(
      parseOnboardingChecklistState(
        JSON.stringify({ completedStepIds: ["portfolio-foundation", "invalid"], updatedAt: "t" }),
      ).completedStepIds,
    ).toEqual(["portfolio-foundation"]);
  });

  it("toggles step completion in localStorage", () => {
    const key = buildOnboardingChecklistStorageKey("test-user");
    expect(toggleOnboardingStepCompletion("test-user", "risk-outlook", true)).toEqual(["risk-outlook"]);
    expect(toggleOnboardingStepCompletion("test-user", "risk-outlook", false)).toEqual([]);
    expect(store.has(key)).toBe(true);
  });
});
