"use client";

import { useEffect, useRef } from "react";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { resolvePositionOptionsChainContext } from "@/app/portfolio/lib/portfolio-position-options-chain";
import { OptionsChainTab } from "@/app/portfolio/ui/OptionsChainTab";
import { XMarkIcon } from "@/app/admin/ui/crud-icons";

type PositionOptionsChainDrawerProps = {
  open: boolean;
  onClose: () => void;
  portfolioIdHex: string;
  accountIdHex: string;
  accountLabel: string;
  position: SerializablePosition | null;
};

export function PositionOptionsChainDrawer({
  open,
  onClose,
  portfolioIdHex,
  accountIdHex,
  accountLabel,
  position
}: PositionOptionsChainDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ctx = position ? resolvePositionOptionsChainContext(position, portfolioIdHex, accountIdHex) : null;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) {
      return;
    }
    if (open && ctx) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [open, ctx]);

  return (
    <dialog
      ref={dialogRef}
      className="portfolio-position-chain-drawer"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="portfolio-position-chain-drawer__panel">
        <header className="portfolio-position-chain-drawer__head">
          <div>
            <p className="portfolio-position-chain-drawer__eyebrow">Position · options chain</p>
            <h2 className="portfolio-position-chain-drawer__title">{ctx?.positionLabel ?? "Options chain"}</h2>
            {ctx?.builderHref ? (
              <p className="portfolio-position-chain-drawer__meta">
                Chain scoped to this leg; open xOptions to continue with the held contract.
              </p>
            ) : (
              <p className="portfolio-position-chain-drawer__meta">
                Chain for this underlying; pick a strike to open xStrategyBuilder.
              </p>
            )}
          </div>
          <button type="button" className="portfolio-position-chain-drawer__close xf-focus-ring" onClick={onClose}>
            <XMarkIcon className="crud-icon" aria-hidden />
            <span className="sr-only">Close</span>
          </button>
        </header>

        {ctx ? (
          <div className="portfolio-position-chain-drawer__body">
            <OptionsChainTab
              variant="position"
              portfolioIdHex={portfolioIdHex}
              accountIdHex={accountIdHex}
              accountLabel={accountLabel}
              brokerTypeLabel=""
              brokerIconSlug={null}
              extAccountRefMasked=""
              initialPositions={[]}
              initialSymbol={ctx.underlying}
              positionLabel={ctx.positionLabel}
              initialSide={ctx.initialSide}
              initialStrike={ctx.initialStrike}
              initialExpiration={ctx.initialExpiration}
              positionBuilderHref={ctx.builderHref}
              positionFullChainHref={ctx.fullChainHref}
            />
          </div>
        ) : (
          <p className="portfolio-position-chain-drawer__empty">Select a stock or option position to view its chain.</p>
        )}
      </div>
    </dialog>
  );
}
