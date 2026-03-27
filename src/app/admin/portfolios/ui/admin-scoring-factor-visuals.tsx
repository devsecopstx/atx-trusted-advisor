import type { ReactElement } from "react";

import type { ScoringFactorId } from "@/modules/core-admin/scoring-factors";

type IconProps = { className?: string };

function IconIvRank(props: IconProps) {
  return (
    <svg aria-hidden className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path d="M4 18V6M9 18v-5M14 18V8M19 18v-9" strokeLinecap="round" />
    </svg>
  );
}

function IconOpenInterest(props: IconProps) {
  return (
    <svg aria-hidden className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <rect height="14" rx="1.5" width="6" x="4" y="6" />
      <rect height="10" rx="1.5" width="6" x="14" y="10" />
    </svg>
  );
}

function IconVolume(props: IconProps) {
  return (
    <svg aria-hidden className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path d="M5 19V5M9 19v-8M13 19V9M17 19v-5M21 19V7" strokeLinecap="round" />
    </svg>
  );
}

function IconLiquidity(props: IconProps) {
  return (
    <svg aria-hidden className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path d="M8 16h8M8 12h5M8 8h10" strokeLinecap="round" />
      <path d="M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconPortfolioFit(props: IconProps) {
  return (
    <svg aria-hidden className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function IconStrategyAlign(props: IconProps) {
  return (
    <svg aria-hidden className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" fill="currentColor" r="2" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2" strokeLinecap="round" />
    </svg>
  );
}

const VISUALS: Record<ScoringFactorId, { Icon: (p: IconProps) => ReactElement; adminKind: string }> = {
  iv_rank: { Icon: IconIvRank, adminKind: "Volatility signal" },
  open_interest: { Icon: IconOpenInterest, adminKind: "Open interest depth" },
  volume: { Icon: IconVolume, adminKind: "Trading activity" },
  liquidity: { Icon: IconLiquidity, adminKind: "Spread / execution" },
  portfolio_fit: { Icon: IconPortfolioFit, adminKind: "Book alignment" },
  strategy_alignment: { Icon: IconStrategyAlign, adminKind: "Outlook & risk fit" }
};

export function AdminScoringFactorVisual({ id }: { id: ScoringFactorId }) {
  const { Icon, adminKind } = VISUALS[id];
  return (
    <div className="admin-scoring-factor-visual">
      <span className="admin-scoring-factor-visual__icon" aria-hidden>
        <Icon />
      </span>
      <span className="admin-scoring-factor-visual__text">
        <span className="admin-scoring-factor-visual__kind">{adminKind}</span>
      </span>
    </div>
  );
}
