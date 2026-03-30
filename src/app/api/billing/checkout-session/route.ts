import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import {
    getStripePriceIdForPlan,
    getStripeSecretKey,
    resolveAppOrigin
} from "@/lib/stripe-config";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  planId: z.enum(["basic", "premium_monthly", "premium_plus_monthly"])
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const secret = getStripeSecretKey();
  if (!secret) {
    return NextResponse.json(
      { error: "Billing is not configured (missing STRIPE_SECRET_KEY)" },
      { status: 503 }
    );
  }

  const priceId = getStripePriceIdForPlan(parsed.data.planId);
  if (!priceId) {
    return NextResponse.json(
      {
        error: "This plan is not configured yet",
        hint: `Set the Stripe Price env for ${parsed.data.planId} (see DEVELOPMENT.md / stripe-billing-setup)`
      },
      { status: 503 }
    );
  }

  const origin = resolveAppOrigin();
  const stripe = new Stripe(secret);

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account/billing?checkout=success`,
      cancel_url: `${origin}/account/billing?checkout=canceled`,
      client_reference_id: session.userId,
      metadata: {
        atx_plan_id: parsed.data.planId,
        atx_user_id: session.userId
      },
      subscription_data: {
        metadata: {
          atx_plan_id: parsed.data.planId,
          atx_user_id: session.userId
        }
      },
      ...(session.email ? { customer_email: session.email } : {})
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    console.warn("[billing/checkout-session]", message);
    return NextResponse.json({ error: "Could not start checkout", detail: message }, { status: 502 });
  }
}
