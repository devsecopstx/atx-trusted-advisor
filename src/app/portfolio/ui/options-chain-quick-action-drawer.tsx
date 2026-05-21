"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { ExternalLinkIcon, XMarkIcon } from "@/app/admin/ui/crud-icons";
import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { buildPortfolioOptionsChainBuilderHref } from "@/lib/portfolio/portfolio-desk-handoff";

export type OptionsChainQuickActionSelection = {
  symbol: string;
  side: "call" | "put";
  strike: number;
  expiration: string;
  spot: number;
  bid: number;
  ask: number;
  mid: number;
};

type OptionsChainQuickActionDrawerProps = {
  open: boolean;
  onClose: () => void;
  portfolioIdHex: string;
  accountIdHex: string;
  accountLabel: string;
  selection: OptionsChainQuickActionSelection | null;
};

export function OptionsChainQuickActionDrawer({
  open,
  onClose,
  portfolioIdHex,
  accountIdHex,
  accountLabel,
  selection
}: OptionsChainQuickActionDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && selection) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }
    if (dialog.open) {
      dialog.close();
    }
  }, [open, selection]);

  const builderHref =
    selection != null
      ? buildPortfolioOptionsChainBuilderHref({
          portfolioIdHex,
          accountIdHex,
          symbol: selection.symbol,
          expiration: selection.expiration,
          side: selection.side,
          strike: selection.strike
        })
      : "/xoptions";

  const fullChainHref = selection
    ? `/xoptions/full-chain?symbol=${encodeURIComponent(selection.symbol)}`
    : "/xoptions/full-chain";

  return (
    <dialog
      ref={dialogRef}
      className="portfolio-options-chain-drawer xf-noise-overlay"
      aria-labelledby="portfolio-options-chain-drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="portfolio-options-chain-drawer__panel">
        <header className="portfolio-options-chain-drawer__head">
          <div>
            <p className="portfolio-options-chain-drawer__eyebrow">Quick action</p>
            <h2 id="portfolio-options-chain-drawer-title" className="portfolio-options-chain-drawer__title">
              Build strategy
            </h2>
          </div>
          <button type="button" className="portfolio-options-chain-drawer__close xf-focus-ring" onClick={onClose}>
            <XMarkIcon className="crud-icon" aria-hidden />
            <span className="sr-only">Close</span>
          </button>
        </header>

        {selection ? (
          <>
            <div className="portfolio-options-chain-drawer__summary">
              <div className="portfolio-options-chain-drawer__symbol-row">
                <PortfolioSymbolMark symbol={selection.symbol} size={28} />
                <div>
                  <p className="portfolio-options-chain-drawer__symbol font-mono">{selection.symbol}</p>
                  <p className="portfolio-options-chain-drawer__meta">
                    {selection.side === "call" ? "Call" : "Put"} · strike{" "}
                    <span className="font-mono">{selection.strike}</span> · exp{" "}
                    <span className="font-mono">{selection.expiration.slice(0, 10)}</span>
                  </p>
                </div>
              </div>
              <dl className="portfolio-options-chain-drawer__quotes">
                <div>
                  <dt>Spot</dt>
                  <dd className="font-mono">${selection.spot.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Bid / Ask</dt>
                  <dd className="font-mono">
                    ${selection.bid.toFixed(2)} / ${selection.ask.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt>Mid</dt>
                  <dd className="font-mono">${selection.mid.toFixed(2)}</dd>
                </div>
              </dl>
              <p className="portfolio-options-chain-drawer__account-hint">
                Account: <strong>{accountLabel}</strong> — educational research only; not a trade ticket.
              </p>
            </div>

            <div className="portfolio-options-chain-drawer__actions">
              <Link className="cta cta-primary portfolio-options-chain-drawer__cta" href={builderHref}>
                Open xStrategyBuilder
                <ExternalLinkIcon className="crud-icon" aria-hidden />
              </Link>
              <Link className="cta cta-secondary portfolio-options-chain-drawer__cta" href={fullChainHref}>
                Full option chain
              </Link>
              <Link
                className="portfolio-options-chain-drawer__text-link"
                href={`/xoptions?portfolioId=${encodeURIComponent(portfolioIdHex)}&accountId=${encodeURIComponent(accountIdHex)}&symbol=${encodeURIComponent(selection.symbol)}`}
              >
                xOptions workspace
              </Link>
            </div>
          </>
        ) : (
          <p className="portfolio-options-chain-drawer__empty">Select a strike row to continue.</p>
        )}
      </div>
    </dialog>
  );
}
