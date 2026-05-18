import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import {
    isAppUserProductAccessAllowedState,
    isBillingEntitledAccessState,
    resolveAppUserBillingAccessState
} from "@/lib/app-user-billing-state";
import { requireSessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserByIdCached } from "@/lib/server-request-cache";

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const hasAppLoginRole = canUserLogin(session.roles);
  const adminSession = isGlobalAdmin(session.roles);
  const coreUser =
    ObjectId.isValid(session.userId) && hasAppLoginRole && !adminSession
      ? await getCoreUserByIdCached(session.userId)
      : null;

  const billingState = resolveAppUserBillingAccessState({
    roles: session.roles,
    billing: coreUser?.billing
  });
  const subscriptionActive = isBillingEntitledAccessState(billingState);
  const productAccessAllowed = isAppUserProductAccessAllowedState(billingState);
  const requiresBilling = hasAppLoginRole && !adminSession && !productAccessAllowed;

  return NextResponse.json({
    data: {
      billingState,
      /** @deprecated prefer productAccessAllowed — kept for older clients */
      entitled: productAccessAllowed,
      subscriptionActive,
      productAccessAllowed,
      requiresBilling,
      redirectPath: "/account/billing"
    }
  });
}

