"use client";

import { useEffect } from "react";

import { readXfUiThemePreferenceFromStorage } from "@/lib/xf-ui-theme";

/** Sets `data-skyline` once when appearance is System — local clock 06:00–17:59 = day. */
export function SkylineTimeBoot() {
  useEffect(() => {
    if (readXfUiThemePreferenceFromStorage() !== "system") {
      return;
    }
    const hour = new Date().getHours();
    const phase = hour >= 6 && hour < 18 ? "day" : "night";
    document.documentElement.setAttribute("data-skyline", phase);
  }, []);

  return null;
}
