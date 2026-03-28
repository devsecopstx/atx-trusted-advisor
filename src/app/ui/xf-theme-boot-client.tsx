"use client";

import { useEffect } from "react";

import { applyXfUiToDocument, readXfUiThemePreferenceFromStorage } from "@/lib/xf-ui-theme";

export function XfThemeBootClient() {
  useEffect(() => {
    const pref = readXfUiThemePreferenceFromStorage();
    applyXfUiToDocument(pref);
  }, []);

  return null;
}
