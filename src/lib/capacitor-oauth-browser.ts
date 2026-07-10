"use client";

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

import { isCapacitorNativePlatform } from "@/lib/capacitor-native";
import {
  parseCapacitorOAuthCompleteDeepLink,
  withCapNativeOAuthQuery
} from "@/lib/capacitor-oauth";

let capacitorOAuthListenersRegistered = false;

function toAbsoluteOAuthLoginUrl(href: string): string {
  return new URL(href, window.location.origin).toString();
}

export async function openOAuthLoginInCapacitorBrowser(href: string): Promise<void> {
  const url = withCapNativeOAuthQuery(toAbsoluteOAuthLoginUrl(href));
  await Browser.open({ url });
}

/** Register once in the Capacitor shell: deep-link return + browser-dismiss reload fallback. */
export function registerCapacitorOAuthListeners(): void {
  if (!isCapacitorNativePlatform() || capacitorOAuthListenersRegistered) {
    return;
  }
  capacitorOAuthListenersRegistered = true;

  void App.addListener("appUrlOpen", (event) => {
    const parsed = parseCapacitorOAuthCompleteDeepLink(event.url);
    if (!parsed) {
      return;
    }
    void (async () => {
      try {
        await Browser.close();
      } catch {
        /* sheet may already be closed */
      }
      window.location.assign(parsed.nextPath);
    })();
  });

  void Browser.addListener("browserFinished", () => {
    window.location.reload();
  });
}
