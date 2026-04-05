"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
    isShowStrategySizingEnabled,
    subscribeXoptionsEducationPrefs
} from "@/lib/xoptions/xoptions-education-preferences";

export type StrategyChoiceId =
  | "long-call"
  | "covered-call"
  | "cash-secured-put"
  | "buy-write"
  | "long-call-spread"
  | "short-put-spread";

export type StrategyCapitalMode = "cash" | "stock";

export type StrategyStartBasis =
  | { mode: "cash"; usd: number }
  | { mode: "stock"; shares: number };

export function parseStrategyStartBasis(mode: StrategyCapitalMode, raw: string): StrategyStartBasis | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (mode === "cash") return { mode: "cash", usd: n };
  return { mode: "stock", shares: Math.floor(n) };
}

/** What you need to open the position (capital vs long stock). */
export type StrategyStartRequirementKind = "cash" | "stock" | "both";

export type StrategyCardModel = {
  id: StrategyChoiceId;
  title: string;
  tier: string;
  requiresKind: StrategyStartRequirementKind;
  /** Short label shown after “Requires” (e.g. cash collateral, long shares). */
  requiresLabel: string;
  /** One line — outlook and shape only. */
  summary: string;
};

export const SINGLE_LEG_STRATEGIES: StrategyCardModel[] = [
  {
    id: "long-call",
    title: "Buy calls",
    tier: "T1",
    requiresKind: "cash",
    requiresLabel: "Cash (premium)",
    summary: "Bullish; risk capped at premium."
  },
  {
    id: "covered-call",
    title: "Covered call",
    tier: "T1",
    requiresKind: "stock",
    requiresLabel: "Stock (long shares)",
    summary: "Premium income; upside capped at strike."
  },
  {
    id: "cash-secured-put",
    title: "Cash-secured put",
    tier: "T1",
    requiresKind: "cash",
    requiresLabel: "Cash (collateral)",
    summary: "Premium income; may be assigned if ITM."
  }
];

export const MULTI_LEG_STRATEGIES: StrategyCardModel[] = [
  {
    id: "buy-write",
    title: "Buy-write",
    tier: "T1",
    requiresKind: "both",
    requiresLabel: "Cash + stock",
    summary: "Buy shares + sell call; income on the bundle."
  },
  {
    id: "long-call-spread",
    title: "Long call spread",
    tier: "T2",
    requiresKind: "cash",
    requiresLabel: "Cash (net debit)",
    summary: "Bullish; capped risk and reward."
  },
  {
    id: "short-put-spread",
    title: "Short put spread",
    tier: "T2",
    requiresKind: "cash",
    requiresLabel: "Cash (margin)",
    summary: "Credit spread; bullish/neutral, defined risk."
  }
];

type StrategyCardProps = {
  model: StrategyCardModel;
  selected: boolean;
  onSelect: () => void;
};

function requirementClass(kind: StrategyStartRequirementKind): string {
  switch (kind) {
    case "cash":
      return "xoptions-strategy-card__req-val--cash";
    case "stock":
      return "xoptions-strategy-card__req-val--stock";
    case "both":
      return "xoptions-strategy-card__req-val--both";
    default: {
      const _x: never = kind;
      return _x;
    }
  }
}

function StrategyCard({ model, selected, onSelect }: StrategyCardProps) {
  const reqHint =
    model.requiresKind === "cash"
      ? "Starts with cash"
      : model.requiresKind === "stock"
        ? "Starts with stock"
        : "Starts with cash and stock";

  return (
    <article className={`xoptions-strategy-card ${selected ? "xoptions-strategy-card--selected" : ""}`}>
      <button
        type="button"
        className="xoptions-strategy-card__main"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select ${model.title}. Requires ${model.requiresLabel}. ${model.summary}`}
      >
        <header className="xoptions-strategy-card__head">
          <h3 className="xoptions-strategy-card__title">{model.title}</h3>
          <span className="xoptions-strategy-card__tier">{model.tier}</span>
        </header>
        <p className="xoptions-strategy-card__req" title={reqHint}>
          <span className="xoptions-strategy-card__req-k">Requires</span>
          <span className={`xoptions-strategy-card__req-val ${requirementClass(model.requiresKind)}`}>
            {model.requiresLabel}
          </span>
        </p>
        <p className="xoptions-strategy-card__lead">{model.summary}</p>
      </button>
    </article>
  );
}

type StrategyChoicePanelsProps = {
  selectedId: StrategyChoiceId | null;
  onSelectStrategy: (id: StrategyChoiceId) => void;
  capitalMode: StrategyCapitalMode;
  capitalInput: string;
  onCapitalModeChange: (mode: StrategyCapitalMode) => void;
  onCapitalInputChange: (value: string) => void;
};

export function StrategyChoicePanels({
  selectedId,
  onSelectStrategy,
  capitalMode,
  capitalInput,
  onCapitalModeChange,
  onCapitalInputChange
}: StrategyChoicePanelsProps) {
  const showSizing = useSyncExternalStore(
    subscribeXoptionsEducationPrefs,
    isShowStrategySizingEnabled,
    () => false
  );

  useEffect(() => {
    if (!showSizing) {
      onCapitalInputChange("");
      onCapitalModeChange("cash");
    }
  }, [showSizing, onCapitalInputChange, onCapitalModeChange]);

  return (
    <div className="xoptions-strategy-panels">
      {showSizing ? (
        <div className="xoptions-strategy-capital">
          <p className="xoptions-strategy-capital__label">Start sizing (optional)</p>
          <div className="xoptions-strategy-capital__row" role="group" aria-label="Size by cash or shares">
            <button
              type="button"
              className={`xoptions-choice ${capitalMode === "cash" ? "xoptions-choice--active" : ""}`}
              onClick={() => onCapitalModeChange("cash")}
              aria-pressed={capitalMode === "cash"}
            >
              Cash
            </button>
            <button
              type="button"
              className={`xoptions-choice ${capitalMode === "stock" ? "xoptions-choice--active" : ""}`}
              onClick={() => onCapitalModeChange("stock")}
              aria-pressed={capitalMode === "stock"}
            >
              Stock (shares)
            </button>
          </div>
          <label className="xoptions-strategy-capital__field" htmlFor="xo-strategy-capital-input">
            <span className="xoptions-strategy-capital__field-label">
              {capitalMode === "cash" ? "Amount (USD)" : "Shares"}
            </span>
            <input
              id="xo-strategy-capital-input"
              type="text"
              inputMode="decimal"
              className="crud-input xoptions-strategy-capital__input font-mono"
              placeholder={capitalMode === "cash" ? "e.g. 5000" : "e.g. 200"}
              value={capitalInput}
              onChange={(e) => onCapitalInputChange(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className="xoptions-strategy-capital__hint">
            {capitalMode === "cash"
              ? "Used as a rough budget hint on the contract step."
              : "Prefills contract quantity from share count (100 shares ≈ 1 contract)."}
          </p>
        </div>
      ) : null}

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
              selected={selectedId === m.id}
              onSelect={() => onSelectStrategy(m.id)}
            />
          ))}
        </div>
      </details>
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
