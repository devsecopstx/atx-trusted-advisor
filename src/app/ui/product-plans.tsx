"use client";

import { useState } from "react";

import {
    ATX_BILLING_PLANS,
    atxBillingPeriodSlash,
    type AtxBillingPlanId
} from "@/lib/atx-billing-plans";

type PlanTier = {
  id: string;
  name: string;
  price: string;
  period: string;
  highlight?: boolean;
  tag?: string;
  limits: string[];
};

const LIMITS_BY_PLAN: Record<AtxBillingPlanId, string[]> = {
  basic: ["Unlimited xChat prompts", "Unlimited Exams (capped)"],
  premium_monthly: [
    "Unlimited xChat prompts",
    "Unlimited Exams (expanded caps)",
    "Expanded xStrategyBuilder posture"
  ],
  premium_plus_monthly: [
    "Unlimited xChat prompts",
    "Unlimited Exams",
    "Early access to new features",
    "Dedicated / white-glove posture"
  ]
};

const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    limits: ["10 xChat prompts / hr", "1 Exam included"]
  },
  ...ATX_BILLING_PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.priceLabel,
    period: atxBillingPeriodSlash(p),
    highlight: Boolean(p.highlight),
    tag: p.highlight ? "Popular" : p.id === "premium_plus_monthly" ? "Beta" : undefined,
    limits: LIMITS_BY_PLAN[p.id]
  }))
];

export function ProductPlans() {
  const [selected, setSelected] = useState("free");

  return (
    <section className="pp-section" aria-label="Product plans">
      <h2 className="pp-heading">Choose Your Plan</h2>
      <p className="pp-sub">Free is pre-selected. Upgrade anytime after sign-up.</p>

      <div className="pp-grid">
        {PLAN_TIERS.map((plan) => {
          const active = plan.id === selected;
          return (
            <label
              className={`pp-card${active ? " pp-card-active" : ""}${plan.highlight ? " pp-card-highlight" : ""}`}
              htmlFor={`pp-${plan.id}`}
              key={plan.id}
            >
              <input
                checked={active}
                id={`pp-${plan.id}`}
                name="plan"
                onChange={() => setSelected(plan.id)}
                type="radio"
                value={plan.id}
                className="pp-radio"
              />
              {plan.tag ? <span className="pp-tag">{plan.tag}</span> : null}
              <span className="pp-name">{plan.name}</span>
              <span className="pp-price">
                {plan.price}
                {plan.period ? <small>{plan.period}</small> : null}
              </span>
              <ul className="pp-limits">
                {plan.limits.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>
    </section>
  );
}
