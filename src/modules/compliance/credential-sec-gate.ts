import { NextResponse } from "next/server";

import { isCredentialSecEnabled } from "@/lib/feature-flags";
import type { Tenant } from "@/modules/identity/types";

/** Blocks FINRA credential APIs when tenant flag `credential-sec` is off (default). */
export function credentialSecFeatureDisabledResponse(): NextResponse {
  return NextResponse.json(
    { error: "feature_disabled", code: "credential_sec_disabled" },
    { status: 404 }
  );
}

export function isCredentialSecFeatureEnabledForTenant(
  tenant: Pick<Tenant, "tenantPreferences"> | null | undefined
): boolean {
  return isCredentialSecEnabled(tenant);
}
