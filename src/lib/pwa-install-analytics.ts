"use client";

export type PwaInstallEventName =
  | "pwa_install_prompt_shown"
  | "pwa_install_prompt_accepted"
  | "pwa_install_prompt_dismissed"
  | "pwa_installed";

export const PWA_INSTALL_ANALYTICS_EVENT = "xfinance:pwa-install-analytics";

export function trackPwaInstallEvent(
  eventName: PwaInstallEventName,
  metadata: Record<string, string | number | boolean | null> = {}
): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload = {
    eventName,
    metadata,
    timestamp: Date.now()
  };
  window.dispatchEvent(
    new CustomEvent(PWA_INSTALL_ANALYTICS_EVENT, {
      detail: payload
    })
  );
}
