"use client";

import { useEffect } from "react";

import {
    DEFAULT_XF_UI_THEME_PREFERENCE,
    XF_UI_THEME_STORAGE_KEY,
    applyXfUiToDocument,
    dispatchXfUiThemeChange,
    readXfUiThemePreferenceFromStorage
} from "@/lib/xf-ui-theme";

export function XfThemeBootClient() {
  useEffect(() => {
    try {
      if (window.localStorage.getItem(XF_UI_THEME_STORAGE_KEY) === null) {
        window.localStorage.setItem(XF_UI_THEME_STORAGE_KEY, DEFAULT_XF_UI_THEME_PREFERENCE);
        dispatchXfUiThemeChange();
      }
    } catch {
      /* ignore quota / private mode */
    }
    applyXfUiToDocument(readXfUiThemePreferenceFromStorage());
  }, []);

  return null;
}
