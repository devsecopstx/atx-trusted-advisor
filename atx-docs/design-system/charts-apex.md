# Charts — ApexCharts (desktop-first product surfaces)

Last updated: 2026-04-02

**PLAN 230n (shipped):** User-facing quantitative charts use **ApexCharts** (`apexcharts` + `react-apexcharts`, dynamic import with `ssr: false`) instead of Chart.js.

## Where it lives

| Surface | Component / file |
|--------|-------------------|
| xStrategyBuilder | `src/app/xstrategybuilder/ui/options-payoff-chart.tsx` — payoff at expiration (area + annotations for spot, strikes, breakevens). |
| xOptions | `src/app/xoptions/xoptions-symbol-chart-panel.tsx` — IV / skew style panels. |

Math helpers for the strategy payoff curve stay in `src/lib/options-payoff.ts` (framework-agnostic).

## Styling

- Dark mode defaults align with `--xf-gain-green` / lightning yellow accents in payoff chart palette (see `options-payoff-chart.tsx` `palette` object).
- Prefer design tokens for surrounding layout; chart series colors remain explicit hex in chart options where Apex series colors require literals (see brand kit for semantic alignment).

## Removed dependencies

`chart.js`, `react-chartjs-2`, and `chartjs-plugin-annotation` were removed from `package.json` (no remaining imports).

## Follow-on (not blocking 230n)

- Portfolio analytics charts: migrate any future Chart.js usage to ApexCharts + shared wrapper defaults.
- xChat stays **mobile-first**; do not assume chart-heavy layouts there without explicit product scope.
