"use client";

import { useState } from "react";

type PlanTier = {
  id: string;
  name: string;
  price: string;
  period: string;
  highlight?: boolean;
  tag?: string;
  limits: string[];
};

const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    limits: ["10 xChat prompts / day", "1 Exam included"],
  },
  {
    id: "paid",
    name: "Paid",
    price: "$10",
    period: "/month",
    highlight: true,
    tag: "Popular",
    limits: ["Unlimited xChat prompts", "Unlimited Exams (capped)"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$99",
    period: "/year",
    tag: "Beta",
    limits: ["Unlimited xChat prompts", "Unlimited Exams", "Early access to new features"],
  },
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
