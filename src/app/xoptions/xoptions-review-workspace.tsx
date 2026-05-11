"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { XoptionsBreadcrumb } from "@/app/xoptions/ui/xoptions-breadcrumb";
import { XoptionsStepper } from "@/app/xoptions/ui/xoptions-stepper";
import { XoptionsPositionReview } from "@/app/xoptions/xoptions-position-review";
import { strategyShortLabel, type StrategyChoiceId } from "@/app/xoptions/xoptions-strategy-choice-panels";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { trackXoptionsEvent } from "@/lib/xoptions/xoptions-analytics";
import { persistXoptionsBuilderSession } from "@/lib/xoptions/xoptions-builder-url";
import type { XoptionsOpeningAction } from "@/lib/xoptions/xoptions-order-preview";
import { formatXoptionsOrderReviewPlainText } from "@/lib/xoptions/xoptions-order-preview";
import type { XoptionsReviewPayload } from "@/lib/xoptions/xoptions-review-types";

const STEPS = [
  { n: 1, title: "Input symbol" },
  { n: 2, title: "Choose outlook" },
  { n: 3, title: "Choose strategy" },
  { n: 4, title: "Choose contract" },
  { n: 5, title: "Review order" }
];

type XoptionsReviewWorkspaceProps = {
  variant?: "standalone" | "embedded";
  symbol: string;
  contractId: string | null;
  expiration: string | null;
  strike: number | null;
  side: "call" | "put" | null;
  limitPrice: string;
  quantity: string;
  openingAction: XoptionsOpeningAction;
  strategyChoiceId: StrategyChoiceId | null;
  strategyLabel: string | null;
  outlook: string | null;
  riskProfile: string | null;
  portfolioApproxValue: number | null;
  holdingSharesForSymbol: number | null;
  reviewOrderPlainText: string | null;
  onAskXchat: () => void;
  onSaveScenario: () => void;
  onAddToWatchlist: () => void;
  onPrint: () => void;
  watchlistBusy: boolean;
  saveScenarioBusy: boolean;
  watchlistStatus: string | null;
  saveScenarioStatus: string | null;
  yahooOptionSymbol: string | null;
};

export function XoptionsReviewWorkspace(props: XoptionsReviewWorkspaceProps) {
  const variant = props.variant ?? "standalone";
  const stackColumns = useMediaQuery("(max-width: 1023px)");
  const [payload, setPayload] = useState<XoptionsReviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("symbol", props.symbol);
    if (props.contractId) {
      params.set("contractId", props.contractId);
    }
    if (props.expiration) {
      params.set("expiration", props.expiration);
    }
    if (props.strike != null) {
      params.set("strike", String(props.strike));
    }
    if (props.side) {
      params.set("side", props.side);
    }
    params.set("limitPrice", props.limitPrice);
    params.set("quantity", props.quantity);
    params.set("openingAction", props.openingAction);
    if (props.strategyLabel) {
      params.set("strategyLabel", props.strategyLabel);
    }
    if (props.outlook) {
      params.set("outlook", props.outlook);
    }
    if (props.riskProfile) {
      params.set("riskProfile", props.riskProfile);
    }
    return params.toString();
  }, [props]);

  useEffect(() => {
    persistXoptionsBuilderSession({
      step: 5,
      symbol: props.symbol,
      contractId: props.contractId,
      outlook: props.outlook,
      strategy: props.strategyChoiceId
    });
  }, [props.contractId, props.outlook, props.strategyChoiceId, props.symbol]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/app-user/xoptions/review?${query}`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("review_endpoint_unavailable");
          }
          throw new Error(`review_${res.status}`);
        }
        const json = (await res.json()) as { data: XoptionsReviewPayload };
        if (!cancelled) {
          setPayload(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setPayload(null);
          const message =
            err instanceof Error && err.message === "review_endpoint_unavailable"
              ? "Review metrics are not available on this server yet. Stay on /xoptions step 5 or restart the dev server after pulling the review API."
              : "Could not load review metrics for this contract.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const reviewPlainText = useMemo(() => {
    if (props.reviewOrderPlainText?.trim()) {
      return props.reviewOrderPlainText.trim();
    }
    if (!payload) {
      return null;
    }
    return formatXoptionsOrderReviewPlainText(payload.orderReview, { includeFootnote: false });
  }, [payload, props.reviewOrderPlainText]);

  const handlePrint = useCallback(() => {
    trackXoptionsEvent("xoptions_export_print", { symbol: props.symbol });
    props.onPrint();
  }, [props]);

  const riskScorePercent = useMemo(() => {
    const cap = payload?.extension.portfolioImpact.maxLossUsd;
    const book = payload?.extension.portfolioImpact.portfolioApproxValueUsd ?? props.portfolioApproxValue;
    if (cap == null || book == null || book <= 0) {
      return null;
    }
    return Math.min(100, (cap / book) * 100);
  }, [payload, props.portfolioApproxValue]);

  return (
    <div className={`xoptions-review-workspace${stackColumns ? " xoptions-review-workspace--stacked" : ""}`}>
      {variant === "standalone" ? (
        <>
          <XoptionsBreadcrumb
            currentStep={5}
            symbol={props.symbol}
            contractId={props.contractId}
            outlook={props.outlook}
            strategy={props.strategyChoiceId}
            unlockedStep={5}
            pathname="/xoptions"
          />
          <XoptionsStepper steps={STEPS} currentStep={5} unlockedStep={5} onStepSelect={() => {}} />
        </>
      ) : null}

      <div className="xoptions-review-workspace__grid">
        <div className="xoptions-review-workspace__main min-w-0">
          {loading ? (
            <p className="text-sm text-[var(--xf-text-400)]" role="status" aria-live="polite">
              Loading review metrics…
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          {payload ? (
            <XoptionsPositionReview
              orderReview={payload.orderReview}
              underlying={props.symbol}
              strategyChoiceId={props.strategyChoiceId}
              strategyLabel={props.strategyLabel ?? strategyShortLabel(props.strategyChoiceId)}
              openingAction={props.openingAction}
              riskScorePercent={riskScorePercent}
              portfolioApproxValue={props.portfolioApproxValue}
              taxEducationEnabled={false}
              holdingSharesForSymbol={props.holdingSharesForSymbol}
              yahooOptionSymbol={props.yahooOptionSymbol ?? props.contractId}
              strike={props.strike ?? 0}
              expirationYyyyMmDd={props.expiration ?? ""}
              quantity={Math.max(1, Number.parseInt(props.quantity, 10) || 1)}
              limitPricePerShare={Number.parseFloat(props.limitPrice) || 0}
              side={props.side ?? "call"}
              riskAlerts={payload.extension.riskAlerts}
              whatIfAssigned={payload.extension.whatIfAssigned}
              reviewSummary={payload.extension.reviewSummary}
              auditTrail={payload.extension.auditTrail}
            />
          ) : null}
        </div>

        <aside className="xoptions-review-workspace__aside" aria-label="Review actions">
          <div className="xoptions-review-workspace__aside-card">
            <h2 className="m-0 text-sm font-semibold text-[var(--xf-text-100)]">Next actions</h2>
            <p className="mt-1 mb-0 text-[0.72rem] leading-snug text-[var(--xf-text-400)]">
              Educational preview only. Execution on IBKR paper is planned for a later release.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                className="cta cta-secondary xoptions-chain-cta"
                disabled={props.watchlistBusy || !props.yahooOptionSymbol}
                onClick={props.onAddToWatchlist}
              >
                {props.watchlistBusy ? "Adding..." : "Add to watchlist"}
              </button>
              <Link
                className="cta cta-primary xoptions-chain-cta text-center"
                href={
                  props.symbol
                    ? `/xoptions/full-chain?symbol=${encodeURIComponent(props.symbol)}`
                    : "/xoptions/full-chain"
                }
              >
                Open full option chain
              </Link>
              <button
                type="button"
                className="cta cta-secondary xoptions-chain-cta"
                disabled={!reviewPlainText}
                onClick={props.onAskXchat}
                aria-label="Copy review order to clipboard and open xChat"
              >
                Ask xChat
              </button>
              <button
                type="button"
                className="cta cta-secondary xoptions-chain-cta"
                disabled={props.saveScenarioBusy || !reviewPlainText}
                onClick={props.onSaveScenario}
              >
                {props.saveScenarioBusy ? "Saving…" : "Save scenario"}
              </button>
              <button type="button" className="cta cta-secondary xoptions-chain-cta" onClick={handlePrint}>
                Print / PDF
              </button>
              <Link className="cta cta-secondary xoptions-chain-cta text-center" href="/xoptions?step=4">
                Edit contract
              </Link>
            </div>
            {props.watchlistStatus ? (
              <p className="mt-2 mb-0 text-xs text-[var(--xf-text-400)]" role="status">
                {props.watchlistStatus}
              </p>
            ) : null}
            {props.saveScenarioStatus ? (
              <p className="mt-2 mb-0 text-xs text-[var(--xf-text-400)]" role="status">
                {props.saveScenarioStatus}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <footer className="xoptions-review-workspace__sticky-footer xoptions-print-hide">
        <button
          type="button"
          className="cta cta-primary w-full"
          disabled={!reviewPlainText}
          onClick={props.onAskXchat}
          aria-label="Continue with xChat review handoff"
        >
          Continue with xChat
        </button>
      </footer>
    </div>
  );
}
