"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { trackPwaInstallEvent } from "@/lib/pwa-install-analytics";

const PWA_INSTALL_DISMISSED_KEY = "xf_pwa_install_dismissed_v1";
const PWA_INSTALL_INSTALLED_KEY = "xf_pwa_install_installed_v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const iosStandalone =
    "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const mediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || mediaStandalone;
}

function readBooleanStorage(key: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(key) === "1";
}

function writeBooleanStorage(key: string, value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, value ? "1" : "0");
}

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const isIos = useMemo(isIosBrowser, []);

  useEffect(() => {
    setIsInstalled(readBooleanStorage(PWA_INSTALL_INSTALLED_KEY) || isStandaloneMode());
    setIsDismissed(readBooleanStorage(PWA_INSTALL_DISMISSED_KEY));
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      writeBooleanStorage(PWA_INSTALL_INSTALLED_KEY, true);
      writeBooleanStorage(PWA_INSTALL_DISMISSED_KEY, true);
      setIsInstalled(true);
      setShowNudge(false);
      setDeferredPrompt(null);
      trackPwaInstallEvent("pwa_installed", { source: "appinstalled" });
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (isInstalled || isDismissed) {
      return;
    }
    const timer = window.setTimeout(() => {
      const eligibleForPrompt = Boolean(deferredPrompt) || isIos;
      if (!eligibleForPrompt) {
        return;
      }
      setShowNudge(true);
      trackPwaInstallEvent("pwa_install_prompt_shown", {
        surface: "engagement_nudge",
        ios: isIos
      });
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [deferredPrompt, isDismissed, isInstalled, isIos]);

  const installLabel = isIos ? "Add to Home Screen" : "Install App";
  const promptSupported = Boolean(deferredPrompt) || isIos;

  const dismissPrompt = useCallback(() => {
    writeBooleanStorage(PWA_INSTALL_DISMISSED_KEY, true);
    setIsDismissed(true);
    setShowNudge(false);
    trackPwaInstallEvent("pwa_install_prompt_dismissed", { source: "maybe_later" });
  }, []);

  const openInstallPrompt = useCallback(async () => {
    if (isInstalled) {
      return;
    }
    if (deferredPrompt) {
      setPromptBusy(true);
      try {
        trackPwaInstallEvent("pwa_install_prompt_shown", { surface: "manual" });
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          writeBooleanStorage(PWA_INSTALL_INSTALLED_KEY, true);
          setIsInstalled(true);
          setShowNudge(false);
          trackPwaInstallEvent("pwa_install_prompt_accepted", { surface: "manual" });
          return;
        }
        trackPwaInstallEvent("pwa_install_prompt_dismissed", { surface: "manual" });
      } finally {
        setPromptBusy(false);
        setDeferredPrompt(null);
      }
      return;
    }
    if (isIos) {
      setShowIosInstructions(true);
      trackPwaInstallEvent("pwa_install_prompt_shown", { surface: "ios_fallback" });
      return;
    }
    trackPwaInstallEvent("pwa_install_prompt_dismissed", { surface: "unsupported" });
  }, [deferredPrompt, isInstalled, isIos]);

  return {
    dismissPrompt,
    installLabel,
    isDismissed,
    isInstalled,
    openInstallPrompt,
    promptBusy,
    promptSupported,
    setShowIosInstructions,
    showIosInstructions,
    showNudge
  };
}
