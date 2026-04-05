"use client";

export const XOPTIONS_EDUCATION_PREFS_CHANGED_EVENT = "xoptions:education-prefs-changed";

const KEY_GREEKS = "xf_xoptions_show_greeks_calc_v1";
const KEY_TAX = "xf_xoptions_tax_education_v1";
const KEY_SHOW_STRATEGY_SIZING = "xf_xoptions_show_strategy_sizing_v1";
const KEY_PAYOFF_PREVIEW = "xf_xoptions_show_payoff_preview_v1";

function dispatch(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(XOPTIONS_EDUCATION_PREFS_CHANGED_EVENT));
}

export function isShowGreeksCalcLogicEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(KEY_GREEKS) === "1";
}

export function setShowGreeksCalcLogicEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(KEY_GREEKS, enabled ? "1" : "0");
  dispatch();
}

export function isTaxEducationEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(KEY_TAX) === "1";
}

export function setTaxEducationEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(KEY_TAX, enabled ? "1" : "0");
  dispatch();
}

/** Gates “Start sizing” on step 3 (cash / shares). Default off. */
export function isShowStrategySizingEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(KEY_SHOW_STRATEGY_SIZING) === "1";
}

export function setShowStrategySizingEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(KEY_SHOW_STRATEGY_SIZING, enabled ? "1" : "0");
  dispatch();
}

/** P/L payoff chart under the chain (step 4). Default off — enable from workspace sidebar on /xoptions. */
function readPayoffPreviewFlag(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(KEY_PAYOFF_PREVIEW) === "1";
}

export function isPayoffPreviewEnabled(): boolean {
  return readPayoffPreviewFlag();
}

/**
 * Pass this to `useSyncExternalStore` as getSnapshot (not `isPayoffPreviewEnabled`).
 * Some production bundles have treated a re-exported function name as non-callable at that callsite;
 * a `const` arrow keeps a stable function value for the hook.
 */
export const getPayoffPreviewSyncSnapshot = (): boolean => readPayoffPreviewFlag();

export function setPayoffPreviewEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(KEY_PAYOFF_PREVIEW, enabled ? "1" : "0");
  dispatch();
}

export function subscribeXoptionsEducationPrefs(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(XOPTIONS_EDUCATION_PREFS_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener(XOPTIONS_EDUCATION_PREFS_CHANGED_EVENT, onChange);
  };
}
