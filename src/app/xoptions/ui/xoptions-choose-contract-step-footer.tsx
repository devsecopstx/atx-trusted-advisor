"use client";

import { XoptionsStrategyGreeksSummary } from "@/app/xoptions/xoptions-strategy-greeks-summary";
import type { XoptionsOrderReview } from "@/lib/xoptions/xoptions-order-preview";
import type { StrategyGreeksSummary } from "@/lib/xoptions/xoptions-strategy-greeks-summary";

type XoptionsChooseContractStepFooterProps = {
  orderReview: XoptionsOrderReview | null;
  strategyGreeksSummary: StrategyGreeksSummary | null;
  watchlistNotes: string;
  onWatchlistNotesChange: (value: string) => void;
  reviewDisabled: boolean;
  onReviewOrderDetails: () => void;
};

function estimatedGrossPremiumDisplay(orderReview: XoptionsOrderReview | null): string {
  if (!orderReview) {
    return "—";
  }
  const match = orderReview.brokerTicketLine.match(/Est premium ([^·]+)/);
  return match?.[1]?.trim() ?? "—";
}

export function XoptionsChooseContractStepFooter({
  orderReview,
  strategyGreeksSummary,
  watchlistNotes,
  onWatchlistNotesChange,
  reviewDisabled,
  onReviewOrderDetails
}: XoptionsChooseContractStepFooterProps) {
  return (
    <div className="xoptions-step4-footer min-w-0 space-y-3">
      <div
        className={`xoptions-step4-footer__cards${strategyGreeksSummary ? "" : " xoptions-step4-footer__cards--notes-only"}`}
      >
        {strategyGreeksSummary ? (
          <div className="xoptions-step4-footer__card">
            <XoptionsStrategyGreeksSummary summary={strategyGreeksSummary} />
          </div>
        ) : null}
        <details className="xoptions-watchlist-notes xoptions-step4-footer__card">
          <summary className="xoptions-watchlist-notes__summary">Add note (optional)</summary>
          <div className="xoptions-watchlist-notes__body">
            <label className="sr-only" htmlFor="xo-watchlist-notes">
              Watchlist notes (optional)
            </label>
            <textarea
              id="xo-watchlist-notes"
              className="crud-input min-h-[3.25rem] w-full min-w-0 touch-manipulation font-mono text-sm md:min-h-[3rem]"
              placeholder="Limit context, catalyst, roll plan"
              value={watchlistNotes}
              onChange={(e) => onWatchlistNotesChange(e.target.value)}
              aria-label="Notes appended when adding contract to watchlist"
            />
          </div>
        </details>
      </div>

      <div className="xoptions-step4-order-row">
        <article className="xoptions-step4-order-summary" aria-label="Order summary">
          <div className="xoptions-step4-order-summary__metrics">
            <div className="xoptions-step4-order-summary__metric">
              <p className="xoptions-step4-order-summary__metric-label">Cash at risk</p>
              <p className="xoptions-step4-order-summary__metric-value">
                {orderReview?.capitalAtRiskDisplay ?? "—"}
              </p>
            </div>
            <div className="xoptions-step4-order-summary__metric">
              <p className="xoptions-step4-order-summary__metric-label">Est premium</p>
              <p className="xoptions-step4-order-summary__metric-value">
                {estimatedGrossPremiumDisplay(orderReview)}
              </p>
            </div>
          </div>
          <p className="xoptions-step4-order-summary__ticket">
            {orderReview?.brokerTicketLine ??
              "Select a contract, limit, and quantity to preview the order ticket."}
          </p>
        </article>
        <div className="xoptions-step4-order-row__actions">
          <button
            type="button"
            className="cta cta-primary xoptions-next-btn xoptions-step4-order-row__cta"
            disabled={reviewDisabled}
            onClick={onReviewOrderDetails}
          >
            Next Review Order
          </button>
        </div>
      </div>
    </div>
  );
}
