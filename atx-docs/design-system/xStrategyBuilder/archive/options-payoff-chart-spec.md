# Options payoff chart & Greeks — implementation spec

Reference for multi-leg payoff visualization and Greeks tables. **Implementation** lives in `src/lib/options-payoff.ts` and `src/app/xstrategybuilder/ui/options-payoff-chart.tsx` (also used from xOptions overlays).

Moved from `.cursor/skills/options-payoff/options-payoff.md` (2026-05-19).

## Objective

Build a clean, professional, production-ready options payoff chart with multi-leg support and integrated Greeks calculation for an options-income / trading analytics platform.

### Core features

- Multi-leg P/L chart (long/short calls & puts)
- Clean "hockey-stick" payoff line with gradient fill
- Vertical dashed reference lines:
  - Current underlying price (yellow/gold)
  - Strike prices (gray, dashed)
  - Breakeven point(s) (red/pink, dashed)
- Full dark mode support
- Accurate Black-Scholes Greeks (Delta, Gamma, Theta, Vega, Rho)
- Responsive, performant, and visually polished

## Technical stack

- Next.js App Router
- TypeScript (strict)
- Tailwind CSS + `--xf-*` chart tokens
- Chart.js + `react-chartjs-2` + `chartjs-plugin-annotation`
- Black-Scholes model (European style)

See also: `atx-docs/design-system/charts-apex.md`.

## Components

### OptionsPayoffChart.tsx

- Accepts array of `Leg` objects
- Renders payoff curve at expiration
- Uses `chartjs-plugin-annotation` for vertical dashed lines
- Supports dark mode via prop / `data-xf-ui`
- Sharp lines, no tension, professional finance look

### GreeksTable.tsx

- Per-leg and net Greeks
- Delta, Gamma, Theta (daily), Vega, Rho

### Black-Scholes (`src/lib/options-payoff.ts`)

- `calculateGreeks()` with `normCDF` / `normPDF`
- Returns delta, gamma, theta (daily), vega, rho

## Leg interface

```ts
export type Leg = {
  id: string;
  type: "call" | "put";
  strike: number;
  premium: number; // per share
  quantity: number;
  side: "long" | "short";
  volatility: number; // IV decimal (0.45 = 45%)
  timeToExp: number; // years (e.g. 14/365)
  riskFreeRate?: number; // default 0.042
  dividendYield?: number; // default 0
};
```

## Tests

- `tests/unit/options-payoff.test.ts` — math helpers
