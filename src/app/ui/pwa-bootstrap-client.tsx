"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker in production and **actively unregisters**
 * any previously-installed worker (and clears its caches) in development.
 *
 * Why the dev unregister:
 *   `next dev` ships chunks with stable filenames (no content hash). The SW
 *   uses stale-while-revalidate for `script` + `style`, so once a chunk is
 *   cached on a Capacitor iOS WebView pointed at `http://127.0.0.1:3000`,
 *   subsequent dev edits return the OLD chunk forever — symptom: code change
 *   on disk but UI never updates in the iOS shell.
 *
 *   The real fix here is to never let the SW touch dev builds; the unregister
 *   path also self-heals devices that already have the previous worker
 *   installed from an earlier session.
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

    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
          if (typeof caches !== "undefined") {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
          }
        } catch {
          /* dev cleanup is best-effort */
        }
      })();
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Keep install prompt path resilient if registration fails in edge browsers.
    });
  }, []);
  return null;
}
