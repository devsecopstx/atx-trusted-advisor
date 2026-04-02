import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    DEFAULT_XF_UI_THEME_PREFERENCE,
    XF_UI_THEME_STORAGE_KEY,
    seedDefaultXfUiThemePreferenceIfUnset
} from "@/lib/xf-ui-theme";

describe("seedDefaultXfUiThemePreferenceIfUnset", () => {
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
    clear() {
      store.clear();
    },
    key(i: number) {
      return Array.from(store.keys())[i] ?? null;
    },
    get length() {
      return store.size;
    }
  };

  let dispatchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store.clear();
    dispatchSpy = vi.fn();
    vi.stubGlobal("window", {
      localStorage: localStoragePolyfill,
      dispatchEvent: dispatchSpy
    } as unknown as Window & typeof globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes dark to localStorage when key is missing", () => {
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBeNull();
    seedDefaultXfUiThemePreferenceIfUnset();
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBe(DEFAULT_XF_UI_THEME_PREFERENCE);
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("does not overwrite an existing preference", () => {
    localStoragePolyfill.setItem(XF_UI_THEME_STORAGE_KEY, "light");
    seedDefaultXfUiThemePreferenceIfUnset();
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBe("light");
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
