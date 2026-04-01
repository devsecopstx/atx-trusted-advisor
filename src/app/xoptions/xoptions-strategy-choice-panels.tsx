"use client";

import Link from "next/link";

import { ExternalLinkIcon } from "@/app/admin/ui/crud-icons";

export type StrategyChoiceId =
  | "long-call"
  | "covered-call"
  | "cash-secured-put"
  | "buy-write"
  | "long-call-spread"
  | "short-put-spread";

export type StrategyCardModel = {
  id: StrategyChoiceId;
  title: string;
  tier: string;
  summary: string;
  bullets: string[];
  expirationBullets: string[];
};

export const SINGLE_LEG_STRATEGIES: StrategyCardModel[] = [
  {
    id: "long-call",
    title: "Buy calls",
    tier: "Tier 1",
    summary: "Profit when the stock rises; risk capped at premium paid.",
    bullets: ["Bullish", "Max loss = premium", "Unlimited upside above breakeven"],
    expirationBullets: ["Profit if spot finishes above breakeven", "Lose premium if spot finishes below strike"]
  },
  {
    id: "covered-call",
    title: "Sell covered calls",
    tier: "Tier 1",
    summary: "Income on shares you own; upside capped at the strike.",
    bullets: ["Flat to mildly bullish", "Premium income", "Stock called away above strike"],
    expirationBullets: ["Max gain near the strike if assigned", "Stock risk below breakeven"]
  },
  {
    id: "cash-secured-put",
    title: "Sell cash-secured puts",
    tier: "Tier 1",
    summary: "Collect premium while targeting a lower entry.",
    bullets: ["Neutral to bullish", "Income from premium", "May be assigned shares if ITM"],
    expirationBullets: ["Keep premium if OTM at expiry", "Losses if spot falls well below strike"]
  }
];

export const MULTI_LEG_STRATEGIES: StrategyCardModel[] = [
  {
    id: "buy-write",
    title: "Buy write",
    tier: "Tier 1",
    summary:
      "This strategy seeks to generate income through the simultaneous purchase of shares and selling a call.",
    bullets: [
      "Benefits from rising prices up to the strike price and/or prices staying flat.",
      "Losses occur when the stock falls below the breakeven price."
    ],
    expirationBullets: [
      "Max profit occurs when the stock price rises up to the strike price.",
      "Losses occur when the stock price falls below the breakeven price."
    ]
  },
  {
    id: "long-call-spread",
    title: "Long call spread",
    tier: "Tier 2",
    summary: "This strategy seeks to benefit from a rising stock price within a predefined range.",
    bullets: [
      "Benefits from rising prices.",
      "Losses occur when premium received for closing is less than net premium paid."
    ],
    expirationBullets: [
      "Max profit occurs when the stock price rises above the highest strike.",
      "Max loss occurs when the stock price falls below the lowest strike."
    ]
  },
  {
    id: "short-put-spread",
    title: "Short put spread",
    tier: "Tier 2",
    summary:
      "This strategy seeks to generate income from a rising or flat stock price but limits risk.",
    bullets: [
      "Benefits from rising and/or flat prices.",
      "Losses occur when premium paid for closing is greater than the net premium received."
    ],
    expirationBullets: [
      "Max profit occurs when the stock price rises above the highest strike.",
      "Max loss occurs when the stock price falls below the lowest strike."
    ]
  }
];

function strikeDiamond(cx: number, cy: number) {
  const s = 2.8;
  return `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
}

function PlLongCall() {
  return (
    <svg className="xoptions-pl-chart" viewBox="0 0 100 52" aria-hidden>
      <title>Long call payoff sketch</title>
      <line className="xoptions-pl-chart__axis" x1="4" y1="44" x2="96" y2="44" />
      <line className="xoptions-pl-chart__axis" x1="4" y1="8" x2="4" y2="44" />
      <polyline
        className="xoptions-pl-chart__loss"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="8,44 44,44"
      />
      <polyline
        className="xoptions-pl-chart__gain"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="44,44 92,10"
      />
      <circle className="xoptions-pl-chart__strike" cx="44" cy="44" r="2.2" />
      <circle className="xoptions-pl-chart__be" cx="52" cy="44" r="2" />
    </svg>
  );
}

function PlCoveredCall() {
  return (
    <svg className="xoptions-pl-chart" viewBox="0 0 100 52" aria-hidden>
      <title>Covered call payoff sketch</title>
      <line className="xoptions-pl-chart__axis" x1="4" y1="44" x2="96" y2="44" />
      <line className="xoptions-pl-chart__axis" x1="4" y1="8" x2="4" y2="44" />
      <polyline
        className="xoptions-pl-chart__loss"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        points="8,46 36,28"
      />
      <polyline
        className="xoptions-pl-chart__gain"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        points="36,28 72,18 92,18"
      />
      <circle className="xoptions-pl-chart__strike" cx="72" cy="18" r="2.2" />
      <circle className="xoptions-pl-chart__be" cx="44" cy="28" r="2" />
    </svg>
  );
}

function PlBuyWrite() {
  return (
    <svg className="xoptions-pl-chart" viewBox="0 0 100 52" aria-hidden>
      <title>Buy write payoff sketch</title>
      <line className="xoptions-pl-chart__axis" x1="4" y1="44" x2="96" y2="44" />
      <line className="xoptions-pl-chart__axis" x1="4" y1="8" x2="4" y2="44" />
      <polyline
        className="xoptions-pl-chart__loss"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        points="8,46 36,28"
      />
      <polyline
        className="xoptions-pl-chart__gain"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        points="36,28 72,18 92,18"
      />
      <polygon className="xoptions-pl-chart__strike" points={strikeDiamond(72, 44)} />
      <circle className="xoptions-pl-chart__be" cx="44" cy="28" r="2" />
    </svg>
  );
}

function PlLongCallSpread() {
  return (
    <svg className="xoptions-pl-chart" viewBox="0 0 100 52" aria-hidden>
      <title>Long call spread payoff sketch</title>
      <line className="xoptions-pl-chart__axis" x1="4" y1="44" x2="96" y2="44" />
      <line className="xoptions-pl-chart__axis" x1="4" y1="8" x2="4" y2="44" />
      <polyline
        className="xoptions-pl-chart__loss"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="8,40 30,40"
      />
      <polyline
        className="xoptions-pl-chart__gain"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="30,40 52,26 68,26 92,26"
      />
      <polygon className="xoptions-pl-chart__strike" points={strikeDiamond(30, 44)} />
      <polygon className="xoptions-pl-chart__strike" points={strikeDiamond(68, 44)} />
      <circle className="xoptions-pl-chart__be" cx="40" cy="34" r="2" />
    </svg>
  );
}

function PlShortPutSpread() {
  return (
    <svg className="xoptions-pl-chart" viewBox="0 0 100 52" aria-hidden>
      <title>Short put spread payoff sketch</title>
      <line className="xoptions-pl-chart__axis" x1="4" y1="44" x2="96" y2="44" />
      <line className="xoptions-pl-chart__axis" x1="4" y1="8" x2="4" y2="44" />
      <polyline
        className="xoptions-pl-chart__loss"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="8,40 28,40"
      />
      <polyline
        className="xoptions-pl-chart__gain"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="28,40 50,26 70,26 92,26"
      />
      <polygon className="xoptions-pl-chart__strike" points={strikeDiamond(28, 44)} />
      <polygon className="xoptions-pl-chart__strike" points={strikeDiamond(70, 44)} />
      <circle className="xoptions-pl-chart__be" cx="38" cy="34" r="2" />
    </svg>
  );
}

function PlCashSecuredPut() {
  return (
    <svg className="xoptions-pl-chart" viewBox="0 0 100 52" aria-hidden>
      <title>Cash-secured put payoff sketch</title>
      <line className="xoptions-pl-chart__axis" x1="4" y1="44" x2="96" y2="44" />
      <line className="xoptions-pl-chart__axis" x1="4" y1="8" x2="4" y2="44" />
      <polyline
        className="xoptions-pl-chart__loss"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        points="8,46 40,24"
      />
      <polyline
        className="xoptions-pl-chart__gain"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        points="40,24 88,20"
      />
      <circle className="xoptions-pl-chart__strike" cx="40" cy="24" r="2.2" />
      <circle className="xoptions-pl-chart__be" cx="48" cy="24" r="2" />
    </svg>
  );
}

function PlForStrategy(id: StrategyChoiceId) {
  switch (id) {
    case "long-call":
      return <PlLongCall />;
    case "covered-call":
      return <PlCoveredCall />;
    case "cash-secured-put":
      return <PlCashSecuredPut />;
    case "buy-write":
      return <PlBuyWrite />;
    case "long-call-spread":
      return <PlLongCallSpread />;
    case "short-put-spread":
      return <PlShortPutSpread />;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

type StrategyCardProps = {
  model: StrategyCardModel;
  symbol: string;
  selected: boolean;
  onSelect: () => void;
};

function StrategyCard({ model, symbol, selected, onSelect }: StrategyCardProps) {
  const q = symbol.trim()
    ? `symbol=${encodeURIComponent(symbol.trim())}&strategy=${encodeURIComponent(model.id)}`
    : `strategy=${encodeURIComponent(model.id)}`;

  return (
    <article className={`xoptions-strategy-card ${selected ? "xoptions-strategy-card--selected" : ""}`}>
      <button
        type="button"
        className="xoptions-strategy-card__main"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select ${model.title}`}
      >
        <header className="xoptions-strategy-card__head">
          <h3 className="xoptions-strategy-card__title">{model.title}</h3>
          <span className="xoptions-strategy-card__tier">{model.tier}</span>
        </header>
        <p className="xoptions-strategy-card__lead">{model.summary}</p>
        <ul className="xoptions-strategy-card__bullets">
          {model.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="xoptions-strategy-card__subhead">At expiration</p>
        <ul className="xoptions-strategy-card__bullets xoptions-strategy-card__bullets--nested">
          {model.expirationBullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="xoptions-strategy-card__chart">{PlForStrategy(model.id)}</div>
      </button>
      <footer className="xoptions-strategy-card__foot">
        <Link
          className="xoptions-strategy-card__learn inline-flex items-center gap-1"
          href={`/xstrategybuilder/strategy-options?${q}`}
        >
          Learn more
          <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        </Link>
      </footer>
    </article>
  );
}

type StrategyChoicePanelsProps = {
  symbol: string;
  selectedId: StrategyChoiceId | null;
  onSelectStrategy: (id: StrategyChoiceId) => void;
};

export function StrategyChoicePanels({ symbol, selectedId, onSelectStrategy }: StrategyChoicePanelsProps) {
  return (
    <div className="xoptions-strategy-panels">
      <details className="xoptions-strategy-acc" open>
        <summary className="xoptions-strategy-acc__summary">
          <span className="xoptions-strategy-acc__label">Single-leg strategy</span>
          <span className="xoptions-strategy-acc__chev" aria-hidden>
            ▸
          </span>
        </summary>
        <div className="xoptions-strategy-grid">
          {SINGLE_LEG_STRATEGIES.map((m) => (
            <StrategyCard
              key={m.id}
              model={m}
              symbol={symbol}
              selected={selectedId === m.id}
              onSelect={() => onSelectStrategy(m.id)}
            />
          ))}
        </div>
      </details>

      <details className="xoptions-strategy-acc">
        <summary className="xoptions-strategy-acc__summary">
          <span className="xoptions-strategy-acc__label">Multi-leg strategy</span>
          <span className="xoptions-strategy-acc__chev" aria-hidden>
            ▸
          </span>
        </summary>
        <div className="xoptions-strategy-grid">
          {MULTI_LEG_STRATEGIES.map((m) => (
            <StrategyCard
              key={m.id}
              model={m}
              symbol={symbol}
              selected={selectedId === m.id}
              onSelect={() => onSelectStrategy(m.id)}
            />
          ))}
        </div>
      </details>

      <div className="xoptions-strategy-legend" role="note">
        <span className="xoptions-strategy-legend__item">
          <span className="xoptions-strategy-legend__diamond" aria-hidden>
            ◇
          </span>{" "}
          Strike
        </span>
        <span className="xoptions-strategy-legend__item">
          <span className="xoptions-strategy-legend__dot" aria-hidden>
            ●
          </span>{" "}
          Breakeven
        </span>
        <span className="xoptions-strategy-legend__item xoptions-strategy-legend__item--muted">x: stock price</span>
        <span className="xoptions-strategy-legend__item xoptions-strategy-legend__item--muted">y: P/L</span>
      </div>
    </div>
  );
}

export function strategyShortLabel(id: StrategyChoiceId | null): string | null {
  if (!id) return null;
  const single = SINGLE_LEG_STRATEGIES.find((s) => s.id === id);
  if (single) return single.title;
  const multi = MULTI_LEG_STRATEGIES.find((s) => s.id === id);
  return multi?.title ?? null;
}
