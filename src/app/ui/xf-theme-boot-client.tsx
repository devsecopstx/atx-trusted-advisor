"use client";

import { useEffect } from "react";

import {
    applyXfUiToDocument,
    bootstrapXfUiThemeWithOptionalTenantDefault,
    readXfUiThemePreferenceFromStorage,
    XF_UI_THEME_CHANGE_EVENT,
    type XfUiThemePreference
} from "@/lib/xf-ui-theme";

type Props = {
  /** From `core_tenants.tenantPreferences.xf_ui_theme` when the session tenant sets it. */
  tenantDefaultTheme?: XfUiThemePreference;
};

export function XfThemeBootClient({ tenantDefaultTheme }: Props) {
  useEffect(() => {
    bootstrapXfUiThemeWithOptionalTenantDefault(tenantDefaultTheme);
    applyXfUiToDocument(readXfUiThemePreferenceFromStorage());
  }, [tenantDefaultTheme]);

  /**
   * When the stored preference is `system`, follow `prefers-color-scheme` (tenant default or user picker).
   * Subscribes to theme change events so switching to/from system without remounting the picker still works.
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let mqCleanup: (() => void) | undefined;
    const attachIfSystem = () => {
      mqCleanup?.();
      mqCleanup = undefined;
      if (readXfUiThemePreferenceFromStorage() !== "system") {
        return;
      }
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const onScheme = () => {
        applyXfUiToDocument("system");
      };
      onScheme();
      mq.addEventListener("change", onScheme);
      mqCleanup = () => mq.removeEventListener("change", onScheme);
    };
    attachIfSystem();
    window.addEventListener(XF_UI_THEME_CHANGE_EVENT, attachIfSystem);
    return () => {
      window.removeEventListener(XF_UI_THEME_CHANGE_EVENT, attachIfSystem);
      mqCleanup?.();
    };
  }, [tenantDefaultTheme]);

  return null;
}
