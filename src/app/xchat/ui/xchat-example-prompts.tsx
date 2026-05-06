"use client";

import type { RefObject } from "react";

import { XfHoverHint } from "@/app/ui/xf-hover-hint";

/** HNWI / multi-book advisor prompts — single source for the xChat rail “Example prompts” list. */
export const hnwiComposerSuggestions = [
  "Run an Options Action Scan on my current holdings and recommend STC closes",
  "Suggest the best conservative income strategy (covered calls or wheel) for my portfolio this month",
  "Analyze theta decay and expiration risk on my near-term options and recommend rolls or closes",
  "Build a balanced options strategy using my watchlist and current positions",
  "Compare aggressive vs balanced vs conservative outlooks for my top holdings",
  "Review my full portfolio Greeks (delta, gamma, vega) and suggest hedging adjustments",
  "Add high-conviction tickers to my watchlist with full options trade ideas",
  "Show me tax-efficient ways to manage or close these options positions",
  "Optimize multi-portfolio rebalancing based on my current investment outlooks",
  "Create a custom xOptions strategy for one of my key symbols",
  "Set smart price alerts and monitoring for my highest-priority watchlist symbols",
  "What's my overall portfolio risk profile right now and how should I adjust?"
] as const;

export function applyExamplePromptToComposer(
  composerRef: RefObject<HTMLTextAreaElement | null>,
  setInput: (value: string) => void,
  text: string
) {
  setInput(text);
  queueMicrotask(() => {
    const el = composerRef.current;
    if (!el) {
      return;
    }
    el.focus();
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  });
}

export type XchatRailExamplePromptsListProps = {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  setInput: (value: string) => void;
  askInFlight?: boolean;
};

export function XchatRailExamplePromptsList({
  composerRef,
  setInput,
  askInFlight = false
}: XchatRailExamplePromptsListProps) {
  return (
    <ul className="xchat-rail-history-list xchat-rail-example-prompts" role="list">
      {hnwiComposerSuggestions.map((text) => (
        <li className="xchat-rail-history-item" key={text}>
          <XfHoverHint hint={text}>
            <button
              aria-label={`Insert example prompt: ${text}`}
              className="app-user-rail-sublink xchat-rail-link xchat-rail-link--history"
              disabled={askInFlight}
              type="button"
              onClick={() => {
                applyExamplePromptToComposer(composerRef, setInput, text);
              }}
            >
              <span className="xchat-rail-link__text">{text}</span>
            </button>
          </XfHoverHint>
        </li>
      ))}
    </ul>
  );
}
