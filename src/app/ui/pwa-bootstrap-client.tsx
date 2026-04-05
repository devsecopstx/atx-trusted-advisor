"use client";

import { useEffect } from "react";

export function PwaBootstrapClient() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const isSecure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isSecure || !("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Keep install prompt path resilient if registration fails in edge browsers.
    });
  }, []);
  return null;
}
