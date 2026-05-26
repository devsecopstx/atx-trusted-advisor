import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/auth";
import {
  GUEST_LANDING_COOKIE,
  GUEST_LANDING_FOR_QUERY,
  parseGuestLandingAudienceFromTenantPreferences,
  parseGuestLandingForParam,
  resolveGuestLandingVariant,
  type GuestLandingVariant
} from "@/lib/marketing/guest-landing-variant";
import { getPlatformDefaultTenant, getTenantByHexId } from "@/modules/identity/repository";

export async function resolveGuestLandingVariantForRequest(input: {
  session: SessionUser | null;
  forQuery?: string | null;
  /** Override tenant for audience (admin preview); otherwise session tenant or platform default. */
  tenantIdHex?: string | null;
}): Promise<GuestLandingVariant> {
  const cookieStore = await cookies();
  const queryFor = parseGuestLandingForParam(input.forQuery);
  const cookieFor = parseGuestLandingForParam(cookieStore.get(GUEST_LANDING_COOKIE)?.value);

  let tenantAudience: GuestLandingVariant | null = null;
  const explicitTenantHex = input.tenantIdHex?.trim() || input.session?.tenantId?.trim() || "";
  if (explicitTenantHex) {
    const tenant = await getTenantByHexId(explicitTenantHex);
    tenantAudience = parseGuestLandingAudienceFromTenantPreferences(tenant?.tenantPreferences ?? null);
  } else if (!input.session) {
    const defaultTenant = await getPlatformDefaultTenant();
    tenantAudience = parseGuestLandingAudienceFromTenantPreferences(defaultTenant?.tenantPreferences ?? null);
  }

  return resolveGuestLandingVariant({
    queryFor,
    cookieFor,
    tenantAudience
  });
}

export { GUEST_LANDING_FOR_QUERY };
