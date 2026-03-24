"use client";

import { FormEvent, useState } from "react";

type PlanFeature = {
  text: string;
};

type PlanTier = {
  name: string;
  price: string;
  period: string;
  featured?: boolean;
  features: PlanFeature[];
};

const PLANS: PlanTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    features: [
      { text: "5 xchat prompts per day" },
      { text: "Default xChat: published FinExpert persona (slug xFinance)" },
      { text: "Admins use published Super-Agent" },
      { text: "Web search + X search tools" },
      { text: "Basic portfolio view" },
      { text: "Community support" }
    ]
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    featured: true,
    features: [
      { text: "Unlimited xchat prompts" },
      { text: "All personas + custom personas" },
      { text: "File search + RAG collections" },
      { text: "Full portfolio + watchlist access" },
      { text: "xStrategyBuilder (coming soon)" },
      { text: "Priority response queue" },
      { text: "Email + push notifications" }
    ]
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    features: [
      { text: "Everything in Pro" },
      { text: "Dedicated personas with custom tools" },
      { text: "Multi-user tenant with role management" },
      { text: "API access + batch processing" },
      { text: "Custom collection training" },
      { text: "Dedicated support + SLA" },
      { text: "Audit trail export" }
    ]
  }
];

function CheckIcon() {
  return (
    <svg className="plan-check" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8.5l3 3 7-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

type PlansLandingProps = {
  userEmail: string;
  username?: string;
};

export function PlansLanding({ userEmail, username }: PlansLandingProps) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleRequestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedRole: "viewer",
          reason: reason.trim() || "Requesting xchat access"
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 409) {
          setStatus("submitted");
          return;
        }
        setErrorMessage(payload.error ?? "Request failed");
        setStatus("error");
        return;
      }

      setStatus("submitted");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="plans-landing">
      <div className="plans-landing-inner">
        <div className="plans-landing-hero">
          <h1>Choose Your Plan</h1>
          <p>
            {username ? `Hey @${username}` : `Hey ${userEmail}`} — you&#39;re authenticated but don&#39;t
            have atx Trusted Advisor access yet. Pick a plan and request access below.
          </p>
        </div>

        <div className="plans-grid">
          {PLANS.map((plan) => (
            <article
              className={`plan-card${plan.featured ? " plan-card-featured" : ""}`}
              key={plan.name}
            >
              <div className="plan-card-header">
                <h2 className="plan-card-name">{plan.name}</h2>
                <p className="plan-card-price">
                  {plan.price}
                  <small>{plan.period}</small>
                </p>
              </div>
              <ul className="plan-card-features">
                {plan.features.map((feature) => (
                  <li key={feature.text}>
                    <CheckIcon />
                    {feature.text}
                  </li>
                ))}
              </ul>
              {plan.featured ? (
                <span className="plan-card-cta plan-cta-primary">Most Popular</span>
              ) : (
                <span className="plan-card-cta plan-cta-secondary">{plan.name}</span>
              )}
            </article>
          ))}
        </div>

        {status === "submitted" ? (
          <div className="plans-request-form">
            <p className="status-text" style={{ textAlign: "center" }}>
              Access request submitted. An admin will review and approve your account.
            </p>
          </div>
        ) : (
          <form className="plans-request-form" onSubmit={handleRequestAccess}>
            <p className="eyebrow" style={{ textAlign: "center" }}>
              Request access to get started
            </p>
            <textarea
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you want access? (optional)"
              rows={2}
              value={reason}
            />
            <button
              className="plan-card-cta plan-cta-primary"
              disabled={status === "submitting"}
              type="submit"
            >
              {status === "submitting" ? "Submitting..." : "Request Free Access"}
            </button>
            {errorMessage ? (
              <p className="status-text status-error" style={{ textAlign: "center" }}>
                {errorMessage}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
