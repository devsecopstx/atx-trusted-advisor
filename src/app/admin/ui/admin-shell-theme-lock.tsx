"use client";

import { useLayoutEffect } from "react";

import {
    applyXfUiToDocument,
    readXfUiThemePreferenceFromStorage,
    XF_UI_THEME_CHANGE_EVENT
} from "@/lib/xf-ui-theme";

/**
 * Hub (`/admin/*`) always uses deep dark shell density. Restores the user's product preference on leave.
 */
export function AdminShellThemeLock() {
  useLayoutEffect(() => {
    const enforceHubDark = () => {
      applyXfUiToDocument("dark");
    };
    enforceHubDark();
    window.addEventListener(XF_UI_THEME_CHANGE_EVENT, enforceHubDark);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", enforceHubDark);
    return () => {
      window.removeEventListener(XF_UI_THEME_CHANGE_EVENT, enforceHubDark);
      mq.removeEventListener("change", enforceHubDark);
      applyXfUiToDocument(readXfUiThemePreferenceFromStorage());
    };
  }, []);

  return null;
}
