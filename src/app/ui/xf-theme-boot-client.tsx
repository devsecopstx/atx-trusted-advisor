"use client";

import { useEffect } from "react";

import { applyXfUiToDocument, readXfUiThemePreferenceFromStorage, seedDefaultXfUiThemePreferenceIfUnset } from "@/lib/xf-ui-theme";

export function XfThemeBootClient() {
  useEffect(() => {
    seedDefaultXfUiThemePreferenceIfUnset();
    applyXfUiToDocument(readXfUiThemePreferenceFromStorage());
  }, []);

  return null;
}
