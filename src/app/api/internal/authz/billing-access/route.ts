import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import {
    isBillingEntitledAccessState,
    resolveAppUserBillingAccessState
} from "@/lib/app-user-billing-state";
import { requireSessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const hasAppLoginRole = canUserLogin(session.roles);
  const adminSession = isGlobalAdmin(session.roles);
  const coreUser =
    ObjectId.isValid(session.userId) && hasAppLoginRole && !adminSession
      ? await getCoreUserById(new ObjectId(session.userId))
      : null;

  const billingState = resolveAppUserBillingAccessState({
    roles: session.roles,
    billing: coreUser?.billing
  });
  const entitled = isBillingEntitledAccessState(billingState);
  const requiresBilling = hasAppLoginRole && !adminSession && !entitled;

  return NextResponse.json({
    data: {
      billingState,
      entitled,
      requiresBilling,
      redirectPath: "/account/billing"
    }
  });
}

