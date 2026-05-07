"use client";

import { useId, useState } from "react";

import { motion, useReducedMotion } from "framer-motion";

import { AtxBillingCheckoutButton } from "@/app/account/ui/atx-billing-checkout";
import type { AtxBillingPlanId } from "@/lib/atx-billing-plans";

export type BillingPlanCardPayload = {
  planId: AtxBillingPlanId;
  planName: string;
  highlight?: boolean;
  summaryValueProp: string;
  limitsExpandNote?: string;
  priceAmount: string;
  periodNote: string;
  summaryChips: string[];
  limitRows: { label: string; value: string }[];
};

type BillingPlanCardsClientProps = {
  cards: BillingPlanCardPayload[];
  approved: boolean;
  checkoutReady: boolean;
  /** When set with `guestOnSelectPlan`, guest cards use click handlers instead of GET navigation. */
  guestFormAnchorId?: string;
  guestOnSelectPlan?: (planId: AtxBillingPlanId) => void;
};

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 8l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BillingPlanCard({
  card,
  approved,
  checkoutReady,
  guestFormAnchorId,
  guestOnSelectPlan
}: {
  card: BillingPlanCardPayload;
  approved: boolean;
  checkoutReady: boolean;
  guestFormAnchorId?: string;
  guestOnSelectPlan?: (planId: AtxBillingPlanId) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <article
      className={`billing-card xf-widget billing-card--summary${card.highlight ? " billing-card--highlight" : ""}`}
    >
      {card.highlight ? <span className="billing-card__tag">POPULAR</span> : null}
      <h2 className="billing-card__name">{card.planName}</h2>
      <div className="billing-card__price-row">
        <p className="billing-card__price">{card.priceAmount}</p>
        <p className="billing-card__period">{card.periodNote}</p>
      </div>
      <p className="billing-card__summary-line">{card.summaryValueProp}</p>
      <ul className="billing-card__chip-list">
        {card.summaryChips.map((chip) => (
          <li key={chip}>{chip}</li>
        ))}
      </ul>

      {!approved ? (
        <div className="billing-card__cta">
          {guestOnSelectPlan && guestFormAnchorId ? (
            <button
              className="billing-checkout-button"
              type="button"
              onClick={() => {
                guestOnSelectPlan(card.planId);
                document.getElementById(guestFormAnchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Select &amp; Register
            </button>
          ) : (
            <form method="get">
              <input name="register" type="hidden" value="1" />
              <input name="plan" type="hidden" value={card.planId} />
              <button className="billing-checkout-button" type="submit">
                Select &amp; Register
              </button>
            </form>
          )}
        </div>
      ) : (
        <AtxBillingCheckoutButton checkoutReady={checkoutReady} planId={card.planId} />
      )}

      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        className="billing-card__expand-toggle"
        type="button"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>See full workspace limits &amp; features</span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          className="billing-card__expand-chevron"
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <ChevronDownIcon />
        </motion.span>
      </button>

      <motion.div
        aria-hidden={!expanded}
        className="billing-card__expand-panel-wrap"
        id={panelId}
        initial={false}
        animate={{
          height: expanded ? "auto" : 0,
          opacity: expanded ? 1 : 0
        }}
        transition={{
          height: { duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: reduceMotion ? 0 : 0.2 }
        }}
        style={{ overflow: "hidden" }}
      >
        <div className="billing-card__limits billing-card__limits--accordion">
          <p className="billing-card__limits-title">Workspace limits</p>
          <ul className="billing-card__limits-list">
            {card.limitRows.map((row) => (
              <li key={`${card.planId}-${row.label}`}>
                <span className="billing-card__limits-metric">{row.label}</span>
                <span className="billing-card__limits-value">{row.value}</span>
              </li>
            ))}
          </ul>
          {card.limitsExpandNote ? (
            <p className="billing-card__expand-note">{card.limitsExpandNote}</p>
          ) : null}
        </div>
      </motion.div>
    </article>
  );
}

export function BillingPlanCardsClient({
  cards,
  approved,
  checkoutReady,
  guestFormAnchorId,
  guestOnSelectPlan
}: BillingPlanCardsClientProps) {
  return (
    <div className="billing-grid">
      {cards.map((card) => (
        <BillingPlanCard
          key={card.planId}
          approved={approved}
          card={card}
          checkoutReady={checkoutReady}
          guestFormAnchorId={guestFormAnchorId}
          guestOnSelectPlan={guestOnSelectPlan}
        />
      ))}
    </div>
  );
}
