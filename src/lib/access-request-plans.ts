import type { AtxBillingPlanId } from "@/lib/atx-billing-plans";

export type AccessRequestPlanValue = "free" | "pro" | "enterprise";

export const ACCESS_REQUEST_PLAN_OPTIONS: ReadonlyArray<{
  value: AccessRequestPlanValue;
  label: string;
}> = [
  { value: "free", label: "Basic" },
  { value: "pro", label: "Premium" },
  { value: "enterprise", label: "Premium+" }
] as const;

const ACCESS_REQUEST_PLAN_ALIAS_TO_VALUE: Record<string, AccessRequestPlanValue> = {
  basic: "free",
  free: "free",
  premium: "pro",
  pro: "pro",
  premium_monthly: "pro",
  "premium+": "enterprise",
  premium_plus: "enterprise",
  premium_plus_monthly: "enterprise",
  premium_plus_yearly: "enterprise",
  enterprise: "enterprise"
};

export function parseAccessRequestPlanInput(input: unknown): AccessRequestPlanValue | null {
  if (typeof input !== "string") {
    return null;
  }
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return ACCESS_REQUEST_PLAN_ALIAS_TO_VALUE[normalized] ?? null;
}

export function accessRequestPlanLabel(value: AccessRequestPlanValue): string {
  const hit = ACCESS_REQUEST_PLAN_OPTIONS.find((option) => option.value === value);
  return hit?.label ?? "Basic";
}

export function accessRequestPlanFromBillingPlanId(planId: AtxBillingPlanId): AccessRequestPlanValue {
  if (planId === "premium_monthly") {
    return "pro";
  }
  if (planId === "premium_plus_monthly") {
    return "enterprise";
  }
  return "free";
}
