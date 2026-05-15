import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    XOPTIONS_EDUCATION_PREFS_CHANGED_EVENT,
    getPayoffPreviewSyncSnapshot,
    getQuantTraderSyncSnapshot,
    isPayoffPreviewEnabled,
    isQuantTraderEnabled,
    setPayoffPreviewEnabled,
    setQuantTraderEnabled,
    subscribeXoptionsEducationPrefs
} from "@/lib/xoptions/xoptions-education-preferences";

const KEY_PAYOFF_PREVIEW = "xf_xoptions_show_payoff_preview_v1";
const KEY_QUANT_TRADER = "xf_xoptions_quant_trader_v1";

describe("xoptions education preferences (payoff preview)", () => {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const localStoragePolyfill = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };

  const dispatchEvent = (event: Event): boolean => {
    const handlers = listeners.get(event.type);
    if (!handlers) {
      return true;
    }
    for (const handler of handlers) {
      handler();
    }
    return true;
  };

  beforeEach(() => {
    store.clear();
    listeners.clear();
    vi.stubGlobal(
      "window",
      {
        localStorage: localStoragePolyfill,
        dispatchEvent,
        addEventListener: (eventName: string, handler: () => void) => {
          const set = listeners.get(eventName) ?? new Set<() => void>();
          set.add(handler);
          listeners.set(eventName, set);
        },
        removeEventListener: (eventName: string, handler: () => void) => {
          listeners.get(eventName)?.delete(handler);
        }
      } as unknown as Window & typeof globalThis
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes getPayoffPreviewSyncSnapshot as a function for useSyncExternalStore", () => {
    expect(typeof getPayoffPreviewSyncSnapshot).toBe("function");
  });

  it("getPayoffPreviewSyncSnapshot matches isPayoffPreviewEnabled for the same storage", () => {
    expect(getPayoffPreviewSyncSnapshot()).toBe(false);
    expect(isPayoffPreviewEnabled()).toBe(false);
    store.set(KEY_PAYOFF_PREVIEW, "1");
    expect(getPayoffPreviewSyncSnapshot()).toBe(true);
    expect(isPayoffPreviewEnabled()).toBe(true);
    store.set(KEY_PAYOFF_PREVIEW, "0");
    expect(getPayoffPreviewSyncSnapshot()).toBe(false);
    expect(isPayoffPreviewEnabled()).toBe(false);
  });

  it("notifies subscribers when payoff preview is toggled", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeXoptionsEducationPrefs(onChange);
    setPayoffPreviewEnabled(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(listeners.get(XOPTIONS_EDUCATION_PREFS_CHANGED_EVENT)?.size).toBe(1);
    unsubscribe();
    setPayoffPreviewEnabled(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("exposes quant trader toggle for useSyncExternalStore", () => {
    expect(getQuantTraderSyncSnapshot()).toBe(false);
    expect(isQuantTraderEnabled()).toBe(false);
    store.set(KEY_QUANT_TRADER, "1");
    expect(getQuantTraderSyncSnapshot()).toBe(true);
    setQuantTraderEnabled(false);
    expect(isQuantTraderEnabled()).toBe(false);
  });
});
