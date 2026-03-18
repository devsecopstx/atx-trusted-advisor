"use client";

import { useState } from "react";

type LoginPlanTier = {
  name: "Free" | "Pro" | "Enterprise";
  price: string;
  period: string;
  yearly?: string;
  summary: string;
};

const LOGIN_PLAN_TIERS: LoginPlanTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    summary: "Start with core xChat access and request approval."
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    yearly: "$99.00/year",
    summary: "Higher limits, richer personas, and premium tooling."
  },
  {
    name: "Enterprise",
    price: "$99.00",
    period: "/year",
    summary: "Team controls, audit exports, and dedicated operations support."
  }
];

export function LoginProductPanel() {
  const [selectedPlan, setSelectedPlan] = useState<LoginPlanTier["name"]>("Free");

  return (
    <section className="panel stack-gap login-product-panel" aria-label="Product plans">
      <div className="panel-header">
        <h2>Product Plans</h2>
        <p>Free is pre-selected. Upgrade later after access approval.</p>
      </div>
      <div className="login-plan-grid">
        {LOGIN_PLAN_TIERS.map((plan) => {
          const selected = plan.name === selectedPlan;
          const id = `login-plan-${plan.name.toLowerCase()}`;
          return (
            <label
              className={`login-plan-card${selected ? " login-plan-card-selected" : ""}`}
              htmlFor={id}
              key={plan.name}
            >
              <input
                checked={selected}
                id={id}
                name="selectedPlan"
                onChange={() => setSelectedPlan(plan.name)}
                type="radio"
                value={plan.name}
              />
              <span className="login-plan-card-name">{plan.name}</span>
              <span className="login-plan-card-price">
                {plan.price}
                <small>{plan.period}</small>
              </span>
              {plan.yearly ? (
                <span className="login-plan-card-yearly">{plan.yearly}</span>
              ) : null}
              <span className="login-plan-card-summary">{plan.summary}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
