import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/auth";
import {
  GUEST_LANDING_COOKIE,
  GUEST_LANDING_FOR_QUERY,
  parseGuestLandingForParam,
  resolveGuestLandingVariant,
  type GuestLandingVariant
} from "@/lib/marketing/guest-landing-variant";
import {
  parseGuestLandingAudienceFromTenantPreferences
} from "@/lib/marketing/guest-landing-variant";
import { getTenantByHexId } from "@/modules/identity/repository";

export async function resolveGuestLandingVariantForRequest(input: {
  session: SessionUser | null;
  forQuery?: string | null;
}): Promise<GuestLandingVariant> {
  const cookieStore = await cookies();
  const queryFor = parseGuestLandingForParam(input.forQuery);
  const cookieFor = parseGuestLandingForParam(cookieStore.get(GUEST_LANDING_COOKIE)?.value);

  let tenantAudience: GuestLandingVariant | null = null;
  if (input.session?.tenantId) {
    const tenant = await getTenantByHexId(input.session.tenantId);
    tenantAudience = parseGuestLandingAudienceFromTenantPreferences(tenant?.tenantPreferences ?? null);
  }

  return resolveGuestLandingVariant({
    queryFor,
    cookieFor,
    tenantAudience
  });
}

export { GUEST_LANDING_FOR_QUERY };
