import { z } from "zod";

/** Canonical retail tiers (Mongo `core_users.subscriptionPlan`, access requests, admin UI). */
export const subscriptionPlanValues = ["basic", "premium", "premium_plus"] as const;
export type SubscriptionPlan = (typeof subscriptionPlanValues)[number];

/** Aliases accepted in forms, URLs, and legacy Mongo (`free` / `pro` / `enterprise`). */
const SUBSCRIPTION_PLAN_ALIASES: Readonly<Record<string, SubscriptionPlan>> = {
  basic: "basic",
  free: "basic",
  premium: "premium",
  pro: "premium",
  premium_monthly: "premium",
  enterprise: "premium_plus",
  premium_plus: "premium_plus",
  "premium+": "premium_plus",
  premium_plus_monthly: "premium_plus",
  premium_plus_yearly: "premium_plus"
};

export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlan, string> = {
  basic: "Basic",
  premium: "Premium",
  premium_plus: "Premium+"
};

/** Admin and access-request `<select>` rows — `value` is the stored enum. */
export const SUBSCRIPTION_PLAN_SELECT_OPTIONS: ReadonlyArray<{
  value: SubscriptionPlan;
  label: string;
}> = [
  { value: "basic", label: "Basic" },
  { value: "premium", label: "Premium" },
  { value: "premium_plus", label: "Premium+" }
];

const subscriptionPlanEnum = z.enum(subscriptionPlanValues);

/**
 * Permissive normalization for DB reads and runtime (unknown / legacy slug → tier; garbage → basic).
 */
export function normalizeSubscriptionPlan(raw: unknown): SubscriptionPlan {
  if (raw == null || raw === "") {
    return "basic";
  }
  if (typeof raw !== "string") {
    return "basic";
  }
  const n = raw.trim().toLowerCase();
  if ((subscriptionPlanValues as readonly string[]).includes(n)) {
    return n as SubscriptionPlan;
  }
  return SUBSCRIPTION_PLAN_ALIASES[n] ?? "basic";
}

/**
 * Strict parse for public/admin request bodies — unknown slug → `null`.
 */
export function strictParseSubscriptionPlan(input: unknown): SubscriptionPlan | null {
  if (typeof input !== "string") {
    return null;
  }
  const n = input.trim().toLowerCase();
  if (!n) {
    return null;
  }
  if ((subscriptionPlanValues as readonly string[]).includes(n)) {
    return n as SubscriptionPlan;
  }
  return SUBSCRIPTION_PLAN_ALIASES[n] ?? null;
}

export const zSubscriptionPlan = z.preprocess(
  (v) => normalizeSubscriptionPlan(v),
  subscriptionPlanEnum
);
