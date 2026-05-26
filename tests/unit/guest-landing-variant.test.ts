import { describe, expect, it } from "vitest";

import {
  guestLandingCanonicalPath,
  parseGuestLandingAudienceFromTenantPreferences,
  parseGuestLandingForParam,
  resolveGuestLandingVariant,
  resolveGuestProtectedLoginNext
} from "@/lib/marketing/guest-landing-variant";

describe("guest-landing-variant", () => {
  it("parses for= query aliases", () => {
    expect(parseGuestLandingForParam("hnwi")).toBe("hnwi");
    expect(parseGuestLandingForParam("retail")).toBe("hnwi");
    expect(parseGuestLandingForParam("advisor")).toBe("advisor");
    expect(parseGuestLandingForParam("ia")).toBe("advisor");
    expect(parseGuestLandingForParam("bogus")).toBeNull();
  });

  it("resolves precedence query → cookie → tenant → hnwi default", () => {
    expect(
      resolveGuestLandingVariant({
        queryFor: "advisor",
        cookieFor: "hnwi",
        tenantAudience: "hnwi"
      })
    ).toBe("advisor");
    expect(
      resolveGuestLandingVariant({
        cookieFor: "advisor",
        tenantAudience: "hnwi"
      })
    ).toBe("advisor");
    expect(resolveGuestLandingVariant({ tenantAudience: "advisor" })).toBe("advisor");
    expect(resolveGuestLandingVariant({})).toBe("hnwi");
  });

  it("reads tenantPreferences.guest_landing_audience", () => {
    expect(parseGuestLandingAudienceFromTenantPreferences({ guest_landing_audience: "advisor" })).toBe(
      "advisor"
    );
    expect(parseGuestLandingAudienceFromTenantPreferences({ guest_landing_audience: "nope" })).toBeNull();
  });

  it("builds canonical blast paths", () => {
    expect(guestLandingCanonicalPath("hnwi")).toBe("/?for=hnwi");
    expect(guestLandingCanonicalPath("advisor", "/home")).toBe("/home?for=advisor");
  });

  it("preserves pathname for login next candidates", () => {
    expect(resolveGuestProtectedLoginNext("/xoptions", "?tab=wheel")).toBe("/xoptions?tab=wheel");
    expect(resolveGuestProtectedLoginNext("/xchat", "")).toBe("/xchat");
    expect(resolveGuestProtectedLoginNext("/watchlist", "")).toBe("/watchlist");
  });
});
