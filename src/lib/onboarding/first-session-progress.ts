export const FIRST_SESSION_USEFUL_ASK_MIN_CHARS = 24;

export type FirstSessionStepId = "holdings" | "watchlist" | "ask";

export type FirstSessionStep = {
  id: FirstSessionStepId;
  label: string;
  detail: string;
  href: string;
  done: boolean;
};

export type FirstSessionProgress = {
  steps: FirstSessionStep[];
  completedCount: number;
  total: number;
  complete: boolean;
};

export function deriveFirstSessionProgress(input: {
  hasHoldings: boolean;
  hasWatchlist: boolean;
  hasUsefulAsk: boolean;
}): FirstSessionProgress {
  const steps: FirstSessionStep[] = [
    {
      id: "holdings",
      label: "Holdings",
      detail: "Add positions so covered calls and puts sit on a real book.",
      href: "/portfolio",
      done: input.hasHoldings
    },
    {
      id: "watchlist",
      label: "Watchlist",
      detail: "Curate names the scanner and xOptions can use.",
      href: "/watchlist",
      done: input.hasWatchlist
    },
    {
      id: "ask",
      label: "First ask",
      detail: "Ask xChat about income or a defined-risk options idea.",
      href: "/xchat",
      done: input.hasUsefulAsk
    }
  ];
  const completedCount = steps.filter((step) => step.done).length;
  return {
    steps,
    completedCount,
    total: steps.length,
    complete: completedCount === steps.length
  };
}

/** A saved ask counts once the prompt is long enough to be a real desk question. */
export function isUsefulXchatAsk(message: string | null | undefined): boolean {
  const text = message?.trim() ?? "";
  return text.length >= FIRST_SESSION_USEFUL_ASK_MIN_CHARS;
}
