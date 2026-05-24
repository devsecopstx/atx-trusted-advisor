export type HotPicksBias = "conservative" | "balanced" | "aggressive";

export type HotPicksScope = "portfolio" | "watchlist" | "market";

export type HotPicksGreeks = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
};

export type HotPicksIvSkewPoint = {
  strike: number;
  ivPercent: number;
  side: "put" | "call";
};

export type HotPicksIvSkew = {
  points: HotPicksIvSkewPoint[];
  putSkewLabel: string;
  intensity: string;
  insight: string;
};

export type HotPicksLeg = {
  side: string;
  right: string;
  strike: number;
  expiryYmd: string;
  quantity: number;
};

export type HotPickCard = {
  id: string;
  symbol: string;
  expirationYmd: string;
  strategy: string;
  strategyLabel: string;
  contractLabel: string;
  outlook: "bullish" | "bearish" | "neutral" | string;
  edgeScore: number;
  entry: number;
  breakeven: number;
  popPercent: number;
  estRoiPercent: number;
  ivRankPercent: number;
  maxGainPercent: number;
  maxLossPercent: number;
  rationale: string;
  legs: HotPicksLeg[];
  greeks?: HotPicksGreeks | null;
  ivSkew?: HotPicksIvSkew | null;
};

export type HotPicksMeta = {
  scope: HotPicksScope;
  bias: HotPicksBias;
  portfolioId: string | null;
  minEdgeScore: number;
  maxEdgeScore: number;
  dteMin: number;
  dteMax: number;
  symbolCount: number;
  symbols: string[];
  cachedAt: string;
  cacheTtlSeconds: number;
  cacheHit: boolean;
};

export type HotPicksPayload = {
  picks: HotPickCard[];
  meta: HotPicksMeta;
};

export type HotPicksQueryInput = {
  scope: HotPicksScope;
  bias: HotPicksBias;
  portfolioId: string | null;
  minEdgeScore: number;
  maxEdgeScore: number;
  dteMin: number;
  dteMax: number;
};
