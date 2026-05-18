import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import {
    isAppUserProductAccessAllowedState,
    isBillingEntitledAccessState,
    resolveAppUserBillingAccessState
} from "@/lib/app-user-billing-state";
import { requireSessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import {
  readBillingAccessDecisionCached,
  writeBillingAccessDecisionCached
} from "@/modules/identity/billing-access-decision-cache";
import { getCoreUserByIdCached } from "@/lib/server-request-cache";

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const hasAppLoginRole = canUserLogin(session.roles);
  const adminSession = isGlobalAdmin(session.roles);

  if (ObjectId.isValid(session.userId) && hasAppLoginRole && !adminSession) {
    const cached = await readBillingAccessDecisionCached(session.userId);
    if (cached) {
      const subscriptionActive = isBillingEntitledAccessState(cached.billingState);
      return NextResponse.json({
        data: {
          billingState: cached.billingState,
          entitled: cached.productAccessAllowed,
          subscriptionActive,
          productAccessAllowed: cached.productAccessAllowed,
          requiresBilling: cached.requiresBilling,
          redirectPath: cached.redirectPath
        }
      });
    }
  }

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
  const redirectPath = "/account/billing";

  if (ObjectId.isValid(session.userId) && hasAppLoginRole && !adminSession) {
    await writeBillingAccessDecisionCached(session.userId, {
      billingState,
      productAccessAllowed,
      requiresBilling,
      redirectPath
    });
  }

  return NextResponse.json({
    data: {
      billingState,
      /** @deprecated prefer productAccessAllowed — kept for older clients */
      entitled: productAccessAllowed,
      subscriptionActive,
      productAccessAllowed,
      requiresBilling,
      redirectPath
    }
  });
}

