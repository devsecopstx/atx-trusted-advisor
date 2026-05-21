export type XoptionsChainLeg = {
  last_quote: { bid: number; ask: number };
  premium?: number;
  open_interest?: number;
  volume?: number;
  implied_volatility?: number;
  greeks?: {
    delta: number;
    gamma: number;
    theta_per_day: number;
    vega_per_one_percent_iv: number;
  };
} | null;

export type XoptionsChainRow = {
  strike: number;
  call: XoptionsChainLeg;
  put: XoptionsChainLeg;
};

export type XoptionsChainPayload = {
  underlying: string;
  expiration: string;
  requestedExpiration?: string;
  stockPrice: number;
  dataSource: string;
  note?: string;
  optionChain: XoptionsChainRow[];
  error?: string;
};

export type XoptionsExpirationsPayload = {
  underlying: string;
  expirationDates: string[];
  error?: string;
};
