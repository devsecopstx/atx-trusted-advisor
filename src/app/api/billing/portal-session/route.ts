import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { requireSessionUser } from "@/lib/auth";
import { getStripeSecretKey, resolveAppOrigin } from "@/lib/stripe-config";
import { getCoreUserById } from "@/modules/identity/repository";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const secret = getStripeSecretKey();
  if (!secret) {
    return NextResponse.json(
      { error: "Billing is not configured (missing STRIPE_SECRET_KEY)" },
      { status: 503 }
    );
  }

  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user" }, { status: 400 });
  }

  const coreUser = await getCoreUserById(new ObjectId(session.userId));
  const customerId = coreUser?.stripeCustomerId?.trim();
  if (!customerId) {
    return NextResponse.json(
      {
        error: "No Stripe customer on file",
        hint: "Complete a subscription checkout once; then manage billing from here."
      },
      { status: 400 }
    );
  }

  const origin = resolveAppOrigin();
  const stripe = new Stripe(secret);

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account/billing`
    });
    if (!portalSession.url) {
      return NextResponse.json({ error: "Stripe did not return a portal URL" }, { status: 502 });
    }
    return NextResponse.json({ url: portalSession.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    console.warn("[billing/portal-session]", message);
    return NextResponse.json({ error: "Could not open billing portal", detail: message }, { status: 502 });
  }
}
