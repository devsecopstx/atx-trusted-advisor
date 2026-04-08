"use client";

import { useEffect } from "react";

import {
    applyXfUiToDocument,
    bootstrapXfUiThemeWithOptionalTenantDefault,
    readXfUiThemePreferenceFromStorage,
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

  return null;
}
