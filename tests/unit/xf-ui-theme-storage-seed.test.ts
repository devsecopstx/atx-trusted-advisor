import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    DEFAULT_XF_UI_THEME_PREFERENCE,
    XF_UI_THEME_STORAGE_KEY,
    bootstrapXfUiThemeFromServer,
    bootstrapXfUiThemeWithOptionalTenantDefault,
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

describe("bootstrapXfUiThemeWithOptionalTenantDefault", () => {
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

  it("overwrites localStorage when tenant policy is set (stale dark → light)", () => {
    localStoragePolyfill.setItem(XF_UI_THEME_STORAGE_KEY, "dark");
    bootstrapXfUiThemeWithOptionalTenantDefault("light");
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBe("light");
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("falls back to seed-only when tenant omits theme", () => {
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBeNull();
    bootstrapXfUiThemeWithOptionalTenantDefault(undefined);
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBe(DEFAULT_XF_UI_THEME_PREFERENCE);
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("does not overwrite existing preference when tenant omits theme", () => {
    localStoragePolyfill.setItem(XF_UI_THEME_STORAGE_KEY, "light");
    bootstrapXfUiThemeWithOptionalTenantDefault(undefined);
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBe("light");
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});

describe("bootstrapXfUiThemeFromServer", () => {
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

  it("user theme wins over tenant default", () => {
    localStoragePolyfill.setItem(XF_UI_THEME_STORAGE_KEY, "dark");
    bootstrapXfUiThemeFromServer({ userTheme: "system", tenantDefaultTheme: "light" });
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBe("system");
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("tenant default applies when user theme omitted", () => {
    bootstrapXfUiThemeFromServer({ tenantDefaultTheme: "light" });
    expect(localStoragePolyfill.getItem(XF_UI_THEME_STORAGE_KEY)).toBe("light");
  });
});
