"use client";

import { useEffect } from "react";

import { isCapacitorNativePlatform } from "@/lib/capacitor-native";
import { unregisterAllServiceWorkersAndCaches } from "@/lib/pwa-service-worker-cleanup";

/**
 * Registers the PWA service worker in production browsers and **actively unregisters**
 * any previously-installed worker (and clears its caches) in development and in the
 * Capacitor native shell.
 *
 * Why the dev unregister:
 *   `next dev` ships chunks with stable filenames (no content hash). The SW
 *   uses stale-while-revalidate for `script` + `style`, so once a chunk is
 *   cached on a Capacitor iOS WebView pointed at `http://127.0.0.1:3000`,
 *   subsequent dev edits return the OLD chunk forever — symptom: code change
 *   on disk but UI never updates in the iOS shell.
 *
 * Why skip SW in Capacitor native (prod):
 *   The App Store shell loads the remote HTTPS app. SW-cached scripts/styles can
 *   pin stale UI after a Cloud Run deploy; the native binary does not ship Next
 *   chunks — let the browser HTTP cache + server headers own freshness.
 */
export function PwaBootstrapClient() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const isSecure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isSecure) {
      return;
    }

    const isNativeShell = isCapacitorNativePlatform();

    if (process.env.NODE_ENV !== "production" || isNativeShell) {
      void unregisterAllServiceWorkersAndCaches();
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Keep install prompt path resilient if registration fails in edge browsers.
    });
  }, []);
  return null;
}
