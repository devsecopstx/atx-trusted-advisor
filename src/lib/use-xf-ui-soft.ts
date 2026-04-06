"use client";

import { useSyncExternalStore } from "react";

function subscribeXfUi(callback: () => void) {
  if (typeof document === "undefined") {
    return () => {};
  }
  const el = document.documentElement;
  const obs = new MutationObserver(callback);
  obs.observe(el, { attributes: true, attributeFilter: ["data-xf-ui"] });
  return () => obs.disconnect();
}

function getXfUiSoftSnapshot() {
  if (typeof document === "undefined") {
    return false;
  }
  return document.documentElement.getAttribute("data-xf-ui") === "soft";
}

/** True when `html[data-xf-ui="soft"]` — lightened shell (high-contrast body copy). */
export function useXfUiSoft(): boolean {
  return useSyncExternalStore(subscribeXfUi, getXfUiSoftSnapshot, () => false);
}
