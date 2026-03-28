# Skill: Advanced Options Payoff Chart & Greeks Service

## Objective
Build a clean, professional, production-ready options payoff chart with multi-leg support and integrated Greeks calculation for an options-income / trading analytics platform.

### Core Features Required
- Multi-leg P/L chart (long/short calls & puts)
- Clean "hockey-stick" payoff line with gradient fill
- Vertical dashed reference lines:
  - Current underlying price (yellow/gold)
  - Strike prices (gray, dashed)
  - Breakeven point(s) (red/pink, dashed)
- Full dark mode support
- Accurate Black-Scholes Greeks (Delta, Gamma, Theta, Vega, Rho)
- Responsive, performant, and visually polished

## Technical Stack
- Next.js 14+ (App Router)
- TypeScript (strict)
- Tailwind CSS
- Chart.js + `react-chartjs-2`
- `chartjs-plugin-annotation`
- Black-Scholes model (European style)

## Components to Build / Maintain

### 1. OptionsPayoffChart.tsx
- Accepts array of `Leg` objects
- Renders payoff curve at expiration
- Uses `chartjs-plugin-annotation` for vertical dashed lines
- Supports dark mode via prop
- Sharp lines, no tension, professional finance look

### 2. GreeksTable.tsx
- Displays per-leg and net Greeks
- Clean table layout with dark mode styling
- Shows Delta, Gamma, Theta (daily), Vega, Rho

### 3. Black-Scholes Utility (`utils/blackScholes.ts`)
- `calculateGreeks()` function
- Includes `normCDF` and `normPDF` implementations
- Returns delta, gamma, theta (daily), vega, rho

## Leg Interface (Required)

```ts
export interface Leg {
  id: string;
  type: 'call' | 'put';
  strike: number;
  premium: number;           // per share
  quantity: number;
  side: 'long' | 'short';
  volatility: number;        // IV as decimal (0.45 = 45%)
  timeToExp: number;         // years (e.g. 14/365)
  riskFreeRate?: number;     // default 0.042
  dividendYield?: number;    // default 0
}