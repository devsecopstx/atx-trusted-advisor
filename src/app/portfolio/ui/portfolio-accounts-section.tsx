"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { PortfolioAccountActionsCell } from "@/app/portfolio/ui/portfolio-account-actions-cell";
import { PortfolioAccountManageBar, type PortfolioAccountManageOption } from "@/app/portfolio/ui/portfolio-account-manage-bar";
import { PortfolioAddAccountPanel } from "@/app/portfolio/ui/portfolio-add-account-panel";

export type PortfolioAccountTableRow = {
  accountIdHex: string;
  name: string;
  isDefault: boolean;
  deskLine: string;
  brokerTypeLabel: string;
  /** Static `/brokers/*.png` when type matches a known custodian. */
  brokerIconUrl: string | null;
  extAccountId: string;
  positionsLabel: string;
  costBasisFormatted: string;
  riskDotClassName: string;
};

type Props = {
  portfolioIdHex: string;
  defaultAccountHex: string;
  manageOptions: PortfolioAccountManageOption[];
  rows: PortfolioAccountTableRow[];
  totalAccounts: number;
};

export function PortfolioAccountsSection({
  portfolioIdHex,
  defaultAccountHex,
  manageOptions,
  rows,
  totalAccounts
}: Props) {
  const [userFocusId, setUserFocusId] = useState<string | null>(null);

  const focusAccountId = useMemo(() => {
    if (userFocusId && manageOptions.some((a) => a.id === userFocusId)) {
      return userFocusId;
    }
    return defaultAccountHex;
  }, [userFocusId, defaultAccountHex, manageOptions]);

  return (
    <div className="portfolio-manage-table-card portfolio-panel">
      <div className="portfolio-manage-table-card__bar">
        <h2 className="portfolio-panel__title portfolio-manage-table-card__title" id="accounts-table-heading">
          Accounts
        </h2>
      </div>
      <PortfolioAddAccountPanel portfolioId={portfolioIdHex} />
      <PortfolioAccountManageBar
        accounts={manageOptions}
        selectedAccountId={focusAccountId}
        onSelectedAccountIdChange={setUserFocusId}
      />
      <div className="portfolio-table-wrap">
        <table
          className="portfolio-manage-table portfolio-manage-table--accounts"
          aria-labelledby="accounts-table-heading"
        >
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Broker / ref</th>
              <th scope="col">Positions</th>
              <th scope="col">Cost basis</th>
              <th scope="col">Market value</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.accountIdHex}>
                <td>
                  <div className="portfolio-manage-table__account-cell">
                    <span
                      className={row.riskDotClassName}
                      title="Risk level"
                      aria-hidden
                    />
                    <div>
                      <div className="portfolio-manage-table__account-name">
                        {row.name}
                        {row.isDefault ? (
                          <span className="portfolio-account-card__badge ml-2">Default</span>
                        ) : null}
                      </div>
                      <div className="portfolio-manage-table__account-meta portfolio-manage-table__account-desk">
                        {row.deskLine}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="portfolio-manage-table__mono">
                  <div className="portfolio-manage-table__broker-row">
                    {row.brokerIconUrl ? (
                      <Image
                        className="portfolio-manage-table__broker-icon"
                        src={row.brokerIconUrl}
                        alt=""
                        width={22}
                        height={22}
                      />
                    ) : null}
                    <span className="portfolio-manage-table__broker-label">{row.brokerTypeLabel}</span>
                  </div>
                  <div className="portfolio-manage-table__ref">{row.extAccountId || "—"}</div>
                </td>
                <td className="portfolio-manage-table__num">{row.positionsLabel}</td>
                <td className="portfolio-manage-table__num portfolio-manage-table__emph">
                  {row.costBasisFormatted}
                </td>
                <td
                  className="portfolio-manage-table__muted"
                  title="Open the Holdings tab for live marks"
                >
                  —
                </td>
                <td className="portfolio-manage-table__td-actions">
                  <PortfolioAccountActionsCell
                    portfolioIdHex={portfolioIdHex}
                    accountIdHex={row.accountIdHex}
                    accountName={row.name}
                    totalAccounts={totalAccounts}
                    focusAccountId={focusAccountId}
                    onFocusChange={setUserFocusId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
