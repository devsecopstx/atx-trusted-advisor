"use client";

import Link from "next/link";
import { useMemo } from "react";

import { XoptionsReviewWorkspace } from "@/app/xoptions/xoptions-review-workspace";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import { parseYahooOptionContractId, toYahooOptionContractId } from "@/lib/xoptions/xoptions-contract-id";

type XoptionsReviewRouteMountProps = {
  workspaceBook: AppUserDefaultBook | null;
  symbol: string | null;
  contractId: string | null;
  expiration: string | null;
  strike: number | null;
  side: "call" | "put" | null;
};

export function XoptionsReviewRouteMount({
  workspaceBook,
  symbol,
  contractId,
  expiration,
  strike,
  side
}: XoptionsReviewRouteMountProps) {
  const parsed = useMemo(() => (contractId ? parseYahooOptionContractId(contractId) : null), [contractId]);
  const resolvedSymbol = (parsed?.underlying ?? symbol ?? "").trim().toUpperCase();
  const resolvedExpiration = parsed?.expirationYyyyMmDd ?? expiration;
  const resolvedStrike = parsed?.strike ?? strike;
  const resolvedSide = parsed?.side ?? side;

  if (!resolvedSymbol || !resolvedExpiration || resolvedStrike == null || !resolvedSide) {
    return (
      <div className="xoptions-workspace space-y-3">
        <h1 className="text-xl font-semibold text-[var(--xf-text-100)]">Review order</h1>
        <p className="text-sm text-[var(--xf-text-400)]">
          Add a symbol and contract id (or expiration, strike, and side) to load the review ticket.
        </p>
        <Link className="cta cta-secondary inline-flex" href="/xoptions">
          Back to Find options
        </Link>
      </div>
    );
  }

  return (
    <div className="xoptions-workspace space-y-3">
      <h1 className="text-xl font-semibold text-[var(--xf-text-100)]">Review order</h1>
      <XoptionsReviewWorkspace
        symbol={resolvedSymbol}
        contractId={
          contractId ??
          toYahooOptionContractId({
            underlying: resolvedSymbol,
            expirationYyyyMmDd: resolvedExpiration,
            side: resolvedSide,
            strike: resolvedStrike
          })
        }
        expiration={resolvedExpiration}
        strike={resolvedStrike}
        side={resolvedSide}
        limitPrice="0"
        quantity="1"
        openingAction="buy_to_open"
        strategyChoiceId={null}
        strategyLabel={null}
        outlook={null}
        riskProfile={workspaceBook?.portfolioName ?? null}
        portfolioApproxValue={null}
        holdingSharesForSymbol={null}
        reviewOrderPlainText={null}
        onAskXchat={() => {}}
        onSaveScenario={() => {}}
        onAddToWatchlist={() => {}}
        onPrint={() => window.print()}
        watchlistBusy={false}
        saveScenarioBusy={false}
        watchlistStatus={null}
        saveScenarioStatus={null}
        yahooOptionSymbol={contractId}
      />
    </div>
  );
}
