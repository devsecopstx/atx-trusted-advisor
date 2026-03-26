import Link from "next/link";

import type { PortfolioHoldingRow } from "@/lib/portfolio-holding-rows";
import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";

type PortfolioHoldingsPanelProps = {
  rows: PortfolioHoldingRow[];
};

export function PortfolioHoldingsPanel({ rows }: PortfolioHoldingsPanelProps) {
  return (
    <section className="portfolio-panel portfolio-holdings-panel" aria-labelledby="portfolio-all-holdings-heading">
      <h2 className="portfolio-panel__title" id="portfolio-all-holdings-heading">
        All holdings
      </h2>
      <p className="portfolio-holdings-panel__hint">
        Book values (cost basis) across every linked account. Edit lots from each account’s manage screen.
      </p>
      {rows.length === 0 ? (
        <p className="status-text">No positions yet. Add holdings from an account or use quick add on the portfolios tab.</p>
      ) : (
        <div className="portfolio-table-wrap">
          <table className="portfolio-manage-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Type</th>
                <th scope="col">Symbol / label</th>
                <th scope="col">Details</th>
                <th scope="col">Book value</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.accountIdHex}-${r.symbol}-${i}`}>
                  <td>{r.accountName}</td>
                  <td className="portfolio-manage-table__mono">{r.positionType}</td>
                  <td className="portfolio-manage-table__mono">{r.symbol}</td>
                  <td className="portfolio-manage-table__detail">{r.detail}</td>
                  <td className="portfolio-manage-table__num">{formatUsdWhole(r.bookUsd)}</td>
                  <td>
                    <Link className="portfolio-table-link" href={`/portfolio/accounts/${r.accountIdHex}`}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
