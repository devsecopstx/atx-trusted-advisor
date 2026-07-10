"use client";

import { useEffect } from "react";

import { isCapacitorNativePlatform } from "@/lib/capacitor-native";
import { isOAuthLoginPathname } from "@/lib/capacitor-oauth";
import {
  openOAuthLoginInCapacitorBrowser,
  registerCapacitorOAuthListeners
} from "@/lib/capacitor-oauth-browser";

/**
 * In the Capacitor iOS/Android shell, route X/Google OAuth through
 * `@capacitor/browser` (SFSafariViewController) instead of the embedded WKWebView.
 */
export function CapacitorOAuthBootstrapClient() {
  useEffect(() => {
    if (!isCapacitorNativePlatform()) {
      return;
    }

    registerCapacitorOAuthListeners();

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      const rawHref = anchor.getAttribute("href")?.trim();
      if (!rawHref || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
        return;
      }

      let loginUrl: URL;
      try {
        loginUrl = new URL(rawHref, window.location.origin);
      } catch {
        return;
      }
      if (loginUrl.origin !== window.location.origin) {
        return;
      }
      if (!isOAuthLoginPathname(loginUrl.pathname)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void openOAuthLoginInCapacitorBrowser(loginUrl.toString()).catch(() => {
        window.location.assign(loginUrl.toString());
      });
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  return null;
}
