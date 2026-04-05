"use client";

export const XOPTIONS_STRATEGY_BUILDER_VISIBILITY_CHANGED_EVENT =
  "xoptions:strategy-builder-visibility-changed";

const XOPTIONS_STRATEGY_BUILDER_VISIBILITY_KEY = "xf_xoptions_strategy_builder_visible_v1";

function parseStoredValue(raw: string | null): boolean {
  return raw === "1";
}

export function isXoptionsStrategyBuilderVisible(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return parseStoredValue(window.localStorage.getItem(XOPTIONS_STRATEGY_BUILDER_VISIBILITY_KEY));
}

export function setXoptionsStrategyBuilderVisible(visible: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(XOPTIONS_STRATEGY_BUILDER_VISIBILITY_KEY, visible ? "1" : "0");
  window.dispatchEvent(new CustomEvent(XOPTIONS_STRATEGY_BUILDER_VISIBILITY_CHANGED_EVENT));
}

export function subscribeXoptionsStrategyBuilderVisibility(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(XOPTIONS_STRATEGY_BUILDER_VISIBILITY_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener(XOPTIONS_STRATEGY_BUILDER_VISIBILITY_CHANGED_EVENT, onChange);
  };
}
