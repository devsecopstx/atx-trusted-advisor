export const XOPTIONS_CHAIN_DATA_COLUMN_IDS = [
  "strike",
  "bid",
  "ask",
  "mid",
  "last",
  "iv",
  "volume",
  "oi",
  "delta",
  "gamma",
  "theta",
  "vega",
  "be"
] as const;

export type XoptionsChainDataColumnId = (typeof XOPTIONS_CHAIN_DATA_COLUMN_IDS)[number];

export type XoptionsChainLayoutPresetId = "default" | "greeks" | "liquidity" | "advanced";

export const CHAIN_COLUMN_LABELS: Record<
  XoptionsChainDataColumnId,
  { title: string; abbr: string }
> = {
  strike: { title: "Strike price", abbr: "Strike" },
  bid: { title: "Best bid per share", abbr: "Bid" },
  ask: { title: "Best ask per share", abbr: "Ask" },
  mid: { title: "Midpoint (bid + ask) / 2", abbr: "Mid" },
  last: { title: "Last trade or mid when unavailable", abbr: "Last" },
  iv: { title: "Implied volatility", abbr: "IV" },
  volume: { title: "Contract volume", abbr: "Volume" },
  oi: { title: "Open interest", abbr: "Open Interest" },
  delta: { title: "Delta", abbr: "Delta" },
  gamma: { title: "Gamma", abbr: "Gamma" },
  theta: { title: "Theta — estimated daily time decay ($/share)", abbr: "Theta" },
  vega: { title: "Vega", abbr: "Vega" },
  be: { title: "Break-even vs spot (approx.)", abbr: "BE" }
};

const ALL_IDS: XoptionsChainDataColumnId[] = [...XOPTIONS_CHAIN_DATA_COLUMN_IDS];

const DEFAULT_ORDER: XoptionsChainDataColumnId[] = [
  "strike",
  "bid",
  "ask",
  "mid",
  "last",
  "iv",
  "volume",
  "oi",
  "delta",
  "gamma",
  "theta",
  "vega",
  "be"
];

const GREEKS_ORDER: XoptionsChainDataColumnId[] = [
  "strike",
  "bid",
  "ask",
  "mid",
  "last",
  "delta",
  "gamma",
  "theta",
  "vega",
  "iv",
  "volume",
  "oi",
  "be"
];

/** Emphasize flow + IV/OI; Greeks hidden. */
const LIQUIDITY_ORDER: XoptionsChainDataColumnId[] = [
  "strike",
  "bid",
  "ask",
  "mid",
  "last",
  "iv",
  "volume",
  "oi",
  "be",
  "delta",
  "gamma",
  "theta",
  "vega"
];

const LIQUIDITY_HIDDEN = new Set<XoptionsChainDataColumnId>([
  "delta",
  "gamma",
  "theta",
  "vega"
]);

/** Scanner-style: IV and size before break-even, then Greeks. */
const ADVANCED_ORDER: XoptionsChainDataColumnId[] = [
  "strike",
  "bid",
  "ask",
  "mid",
  "last",
  "iv",
  "volume",
  "oi",
  "delta",
  "gamma",
  "theta",
  "vega",
  "be"
];

export const CHAIN_LAYOUT_STORAGE_KEY = "xoptions:chainColumnLayout:v1";

export type XoptionsChainSavedLayout =
  | { kind: "preset"; preset: XoptionsChainLayoutPresetId }
  | {
      kind: "custom";
      order: XoptionsChainDataColumnId[];
      hidden: XoptionsChainDataColumnId[];
    };

function presetHidden(preset: XoptionsChainLayoutPresetId): Set<XoptionsChainDataColumnId> {
  if (preset === "liquidity") {
    return new Set(LIQUIDITY_HIDDEN);
  }
  return new Set();
}

function presetOrder(preset: XoptionsChainLayoutPresetId): XoptionsChainDataColumnId[] {
  switch (preset) {
    case "default":
      return [...DEFAULT_ORDER];
    case "greeks":
      return [...GREEKS_ORDER];
    case "liquidity":
      return [...LIQUIDITY_ORDER];
    case "advanced":
      return [...ADVANCED_ORDER];
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

export function normalizeColumnOrder(order: XoptionsChainDataColumnId[]): XoptionsChainDataColumnId[] {
  const seen = new Set<XoptionsChainDataColumnId>();
  const out: XoptionsChainDataColumnId[] = [];
  for (const id of order) {
    if (ALL_IDS.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of ALL_IDS) {
    if (!seen.has(id)) {
      out.push(id);
    }
  }
  return out;
}

export function visibleOrderedColumnsFromSaved(saved: XoptionsChainSavedLayout): XoptionsChainDataColumnId[] {
  if (saved.kind === "preset") {
    const hidden = presetHidden(saved.preset);
    return presetOrder(saved.preset).filter((id) => !hidden.has(id));
  }
  const order = normalizeColumnOrder(saved.order);
  const hidden = new Set(saved.hidden);
  return order.filter((id) => !hidden.has(id));
}

export function deriveStateFromSaved(saved: XoptionsChainSavedLayout): {
  preset: XoptionsChainLayoutPresetId | "custom";
  order: XoptionsChainDataColumnId[];
  hidden: Set<XoptionsChainDataColumnId>;
} {
  if (saved.kind === "preset") {
    return {
      preset: saved.preset,
      order: presetOrder(saved.preset),
      hidden: presetHidden(saved.preset)
    };
  }
  return {
    preset: "custom",
    order: normalizeColumnOrder(saved.order),
    hidden: new Set(saved.hidden)
  };
}

export function savedMatchesPreset(
  saved: XoptionsChainSavedLayout,
  preset: XoptionsChainLayoutPresetId
): boolean {
  return saved.kind === "preset" && saved.preset === preset;
}

export function isChainGreekColumnId(id: XoptionsChainDataColumnId): boolean {
  return (
    id === "delta" || id === "gamma" || id === "theta" || id === "vega"
  );
}

/** Visual groups for column separators: Strike | Quotes | IV & flow | Greeks | BE */
export const CHAIN_COLUMN_GROUPS: XoptionsChainDataColumnId[][] = [
  ["strike"],
  ["bid", "ask", "mid", "last"],
  ["iv", "volume", "oi"],
  ["delta", "gamma", "theta", "vega"],
  ["be"]
];

/** True when `cid` is the first visible column of its logical group (respects reorder/hidden cols). */
export function isFirstVisibleColumnInChainGroup(
  cid: XoptionsChainDataColumnId,
  visibleOrdered: readonly XoptionsChainDataColumnId[]
): boolean {
  const group = CHAIN_COLUMN_GROUPS.find((g) => g.includes(cid));
  if (!group) {
    return false;
  }
  const firstPresent = visibleOrdered.find((c) => group.includes(c));
  return firstPresent === cid;
}

export function parseSavedLayout(raw: string | null): XoptionsChainSavedLayout | null {
  if (!raw) {
    return null;
  }
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") {
      return null;
    }
    const o = v as Record<string, unknown>;
    if (o.kind === "preset" && typeof o.preset === "string") {
      const p = o.preset as XoptionsChainLayoutPresetId;
      if (p === "default" || p === "greeks" || p === "liquidity" || p === "advanced") {
        return { kind: "preset", preset: p };
      }
    }
    if (o.kind === "custom" && Array.isArray(o.order) && Array.isArray(o.hidden)) {
      const order = o.order.filter((x): x is XoptionsChainDataColumnId =>
        typeof x === "string" && (ALL_IDS as readonly string[]).includes(x)
      );
      const hidden = o.hidden.filter((x): x is XoptionsChainDataColumnId =>
        typeof x === "string" && (ALL_IDS as readonly string[]).includes(x)
      );
      if (order.length > 0) {
        return { kind: "custom", order: normalizeColumnOrder(order), hidden };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function serializeSavedLayout(saved: XoptionsChainSavedLayout): string {
  return JSON.stringify(saved);
}
