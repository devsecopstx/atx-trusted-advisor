"use client";

import {
    SCORING_FORMULA_DESCRIPTION,
    type PortfolioScoringFactorApi
} from "@/modules/core-admin/scoring-factors";

function formatWeightPct(weight: number): string {
  const pct = weight * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

type PortfolioScoringFactorsReadonlyTableProps = {
  factors: PortfolioScoringFactorApi[];
  /** Full = description column + formula footnote; compact = factor + weight only (e.g. xChat popover). */
  variant?: "full" | "compact";
  /** Override default intro copy (e.g. tenant-level defaults on workspace preferences). */
  intro?: string;
};

export function PortfolioScoringFactorsReadonlyTable({
  factors,
  variant = "full",
  intro
}: PortfolioScoringFactorsReadonlyTableProps) {
  const compact = variant === "compact";
  const introCopy =
    intro ??
    (compact
      ? "Book-level weights used to rank recommendations (read-only)."
      : "Portfolio scoring factors weight how recommendations are ranked for this book (read-only). Workspace admins can adjust weights in the admin console.");
  return (
    <div
      className={`portfolio-scoring-readonly${compact ? " portfolio-scoring-readonly--compact" : ""}`}
    >
      <p className="portfolio-scoring-readonly__intro">{introCopy}</p>
      <div className="portfolio-scoring-readonly__scroll">
        <table className="portfolio-scoring-readonly__table" data-lcp-candidate="portfolio-scoring">
          <thead>
            <tr>
              <th scope="col">Factor</th>
              <th scope="col">Weight</th>
              {!compact ? <th scope="col">Description</th> : null}
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.id}>
                <td className="portfolio-scoring-readonly__factor">
                  <span className="portfolio-scoring-readonly__label">{f.label}</span>
                  <span className="portfolio-scoring-readonly__id font-mono">{f.id}</span>
                </td>
                <td className="portfolio-scoring-readonly__weight font-mono">{formatWeightPct(f.weight)}</td>
                {!compact ? (
                  <td className="portfolio-scoring-readonly__desc">{f.description}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact ? (
        <p className="portfolio-scoring-readonly__formula font-mono">{SCORING_FORMULA_DESCRIPTION}</p>
      ) : null}
    </div>
  );
}
