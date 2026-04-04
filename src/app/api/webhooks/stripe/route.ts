import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripePriceIdForPlan, getStripeSecretKey } from "@/lib/stripe-config";
import { strictParseSubscriptionPlan, type SubscriptionPlan } from "@/lib/subscription-plan";
import { updateCoreUserSubscriptionPlan } from "@/modules/identity/repository";

export const dynamic = "force-dynamic";

function maskUserId(raw: string | null | undefined): string {
  const id = raw?.trim();
  if (!id) {
    return "unknown";
  }
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}

function getStripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function resolvePlanFromPriceId(priceId: string | null | undefined): SubscriptionPlan | null {
  const price = priceId?.trim();
  if (!price) {
    return null;
  }
  const basic = getStripePriceIdForPlan("basic");
  const premium = getStripePriceIdForPlan("premium_monthly");
  const premiumPlus = getStripePriceIdForPlan("premium_plus_monthly");
  if (basic && price === basic) {
    return "basic";
  }
  if (premium && price === premium) {
    return "premium";
  }
  if (premiumPlus && price === premiumPlus) {
    return "premium_plus";
  }
  return null;
}

function resolvePlanFromAtxPlanId(raw: string | null | undefined): SubscriptionPlan | null {
  return strictParseSubscriptionPlan(raw ?? null);
}

function resolveUserIdFromMetadata(
  metadata: Record<string, string> | null | undefined,
  fallback?: string | null
): string | null {
  const metadataId = metadata?.atx_user_id?.trim();
  const fallbackId = fallback?.trim();
  const id = metadataId && metadataId.length > 0 ? metadataId : fallbackId;
  return id && id.length > 0 ? id : null;
}

async function applyPlanForUser(userIdHex: string, subscriptionPlan: SubscriptionPlan): Promise<boolean> {
  if (!ObjectId.isValid(userIdHex)) {
    return false;
  }
  await updateCoreUserSubscriptionPlan({
    userId: new ObjectId(userIdHex),
    subscriptionPlan
  });
  return true;
}

function firstSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const first = subscription.items.data[0];
  return first?.price?.id?.trim() || null;
}

export async function POST(request: Request) {
  const secretKey = getStripeSecretKey();
  const webhookSecret = getStripeWebhookSecret();
  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured (missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET)" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: "Invalid Stripe signature", detail }, { status: 400 });
  }
  console.info("[webhooks/stripe] received", { id: event.id, type: event.type });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = resolveUserIdFromMetadata(session.metadata, session.client_reference_id);
      if (!userId) {
        console.warn("[webhooks/stripe] ignored checkout.session.completed missing user id", {
          id: event.id
        });
        return NextResponse.json({ received: true, ignored: "missing_user_id" });
      }

      let plan =
        resolvePlanFromAtxPlanId(session.metadata?.atx_plan_id) ||
        resolvePlanFromPriceId(
          typeof session.metadata?.atx_price_id === "string" ? session.metadata.atx_price_id : null
        );

      if (!plan && typeof session.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        plan =
          resolvePlanFromAtxPlanId(sub.metadata?.atx_plan_id) ||
          resolvePlanFromPriceId(firstSubscriptionPriceId(sub));
      }

      if (!plan) {
        console.warn("[webhooks/stripe] ignored checkout.session.completed unmapped plan", {
          id: event.id,
          userId: maskUserId(userId)
        });
        return NextResponse.json({ received: true, ignored: "unmapped_plan" });
      }

      const updated = await applyPlanForUser(userId, plan);
      console.info("[webhooks/stripe] handled checkout.session.completed", {
        id: event.id,
        userId: maskUserId(userId),
        plan,
        updated
      });
      return NextResponse.json({ received: true, updated, userId, plan });
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = resolveUserIdFromMetadata(subscription.metadata);
      if (!userId) {
        console.warn("[webhooks/stripe] ignored customer.subscription.updated missing user id", {
          id: event.id
        });
        return NextResponse.json({ received: true, ignored: "missing_user_id" });
      }

      const deactivatedStatuses: ReadonlySet<Stripe.Subscription.Status> = new Set([
        "canceled",
        "incomplete",
        "incomplete_expired"
      ]);
      const status = subscription.status;
      let plan: SubscriptionPlan = "basic";
      if (!deactivatedStatuses.has(status)) {
        plan =
          resolvePlanFromAtxPlanId(subscription.metadata?.atx_plan_id) ||
          resolvePlanFromPriceId(firstSubscriptionPriceId(subscription)) ||
          "basic";
      }

      const updated = await applyPlanForUser(userId, plan);
      console.info("[webhooks/stripe] handled customer.subscription.updated", {
        id: event.id,
        userId: maskUserId(userId),
        plan,
        status,
        updated
      });
      return NextResponse.json({ received: true, updated, userId, plan, status });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = resolveUserIdFromMetadata(subscription.metadata);
      if (!userId) {
        console.warn("[webhooks/stripe] ignored customer.subscription.deleted missing user id", {
          id: event.id
        });
        return NextResponse.json({ received: true, ignored: "missing_user_id" });
      }
      const updated = await applyPlanForUser(userId, "basic");
      console.info("[webhooks/stripe] handled customer.subscription.deleted", {
        id: event.id,
        userId: maskUserId(userId),
        plan: "basic",
        updated
      });
      return NextResponse.json({ received: true, updated, userId, plan: "basic" });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Webhook handler failed";
    console.error("[webhooks/stripe]", detail, { type: event.type, id: event.id });
    return NextResponse.json({ error: "Stripe webhook handling failed", detail }, { status: 500 });
  }

  console.info("[webhooks/stripe] ignored unsupported event", { id: event.id, type: event.type });
  return NextResponse.json({ received: true });
}

