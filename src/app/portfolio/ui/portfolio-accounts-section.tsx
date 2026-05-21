"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";

import { PortfolioAccountActionsCell } from "@/app/portfolio/ui/portfolio-account-actions-cell";
import type { PortfolioAccountManageOption } from "@/app/portfolio/ui/portfolio-account-manage-bar";
import { PortfolioAddAccountPanel } from "@/app/portfolio/ui/portfolio-add-account-panel";
import type { BrokerIconSlug } from "@/lib/broker-ui";

export type PortfolioAccountTableRow = {
  accountIdHex: string;
  name: string;
  isDefault: boolean;
  deskLine: string;
  brokerTypeLabel: string;
  /** Built-in SVG mark from `BrokerIcon` when catalog slug matches. */
  brokerIconSlug: BrokerIconSlug | null;
  extAccountId: string;
  positionsLabel: string;
  /** Book-style cost basis (cash + lots + option premium) when positions exist; otherwise "—". */
  costBasisFormatted: string;
  currentValueFormatted: string;
  todayGainLossFormatted: string;
  todayGainLossTone: "gain" | "loss" | "neutral" | "muted";
  pctOfPortfolioFormatted: string;
  quantityLabel: string;
  riskDotClassName: string;
};

const ACCOUNTS_TABLE_COLS = 9;
const ACCOUNTS_VIRTUAL_MIN_ROWS = 14;
const ACCOUNTS_VIRTUAL_ROW_EST_PX = 56;

type Props = {
  portfolioIdHex: string;
  selectedAccountHex: string;
  onSelectedAccountHexChange: (accountIdHex: string) => void;
  manageOptions: PortfolioAccountManageOption[];
  rows: PortfolioAccountTableRow[];
  totalAccounts: number;
};

type AccountRowProps = {
  row: PortfolioAccountTableRow;
  portfolioIdHex: string;
  totalAccounts: number;
  focusAccountId: string;
  onSelectedAccountHexChange: (accountIdHex: string) => void;
};

function todayGainClass(tone: PortfolioAccountTableRow["todayGainLossTone"]): string {
  if (tone === "gain") return "value-gain value-currency portfolio-manage-table__num";
  if (tone === "loss") return "value-loss value-currency portfolio-manage-table__num";
  if (tone === "neutral") return "value-neutral value-currency portfolio-manage-table__num";
  return "portfolio-manage-table__muted portfolio-manage-table__num value-currency";
}

function PortfolioAccountTableDataRow({
  row,
  portfolioIdHex,
  totalAccounts,
  focusAccountId,
  onSelectedAccountHexChange
}: AccountRowProps) {
  return (
    <tr>
      <td>
        <div className="portfolio-manage-table__account-cell">
          <span className={row.riskDotClassName} title="Risk level" aria-hidden />
          <div>
            <div className="portfolio-manage-table__account-name">
              {row.name}
              {row.isDefault ? <span className="portfolio-account-card__badge ml-2">Default</span> : null}
            </div>
            <div className="portfolio-manage-table__account-meta portfolio-manage-table__account-desk">{row.deskLine}</div>
          </div>
        </div>
      </td>
      <td className="portfolio-manage-table__mono">
        <div className="portfolio-manage-table__broker-label">{row.brokerTypeLabel}</div>
        <div className="portfolio-manage-table__ref">{row.extAccountId || "—"}</div>
      </td>
      <td className="portfolio-manage-table__num">{row.positionsLabel}</td>
      <td className="portfolio-manage-table__num portfolio-manage-table__emph value-currency">
        {row.currentValueFormatted}
      </td>
      <td className={todayGainClass(row.todayGainLossTone)}>{row.todayGainLossFormatted}</td>
      <td className="portfolio-manage-table__num value-currency" title="Share of total portfolio market value (all accounts)">
        {row.pctOfPortfolioFormatted}
      </td>
      <td className="portfolio-manage-table__num portfolio-manage-table__mono">{row.quantityLabel}</td>
      <td className="portfolio-manage-table__num portfolio-manage-table__emph value-currency">{row.costBasisFormatted}</td>
      <td className="portfolio-manage-table__td-actions">
        <PortfolioAccountActionsCell
          portfolioIdHex={portfolioIdHex}
          accountIdHex={row.accountIdHex}
          accountName={row.name}
          totalAccounts={totalAccounts}
          focusAccountId={focusAccountId}
          onFocusChange={onSelectedAccountHexChange}
        />
      </td>
    </tr>
  );
}

export function PortfolioAccountsSection({
  portfolioIdHex,
  selectedAccountHex,
  onSelectedAccountHexChange,
  manageOptions,
  rows,
  totalAccounts
}: Props) {
  const focusAccountId = useMemo(() => {
    if (selectedAccountHex && manageOptions.some((a) => a.id === selectedAccountHex)) {
      return selectedAccountHex;
    }
    return manageOptions[0]?.id ?? "";
  }, [selectedAccountHex, manageOptions]);

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const accountsVirtualize = rows.length >= ACCOUNTS_VIRTUAL_MIN_ROWS;
  /* eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual */
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => ACCOUNTS_VIRTUAL_ROW_EST_PX,
    overscan: 6
  });

  return (
    <div className="portfolio-manage-table-card portfolio-panel">
      <div className="portfolio-manage-table-card__bar">
        <h2 className="portfolio-panel__title portfolio-manage-table-card__title" id="accounts-table-heading">
          Accounts
        </h2>
      </div>
      <PortfolioAddAccountPanel portfolioId={portfolioIdHex} />
      <div
        ref={tableScrollRef}
        className="portfolio-table-wrap"
        style={
          accountsVirtualize
            ? { maxHeight: "min(50vh, 24rem)", overflow: "auto", position: "relative" }
            : undefined
        }
      >
        <table
          className="portfolio-manage-table portfolio-manage-table--accounts"
          aria-labelledby="accounts-table-heading"
        >
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Broker / ref</th>
              <th scope="col">Positions</th>
              <th scope="col">Current value</th>
              <th scope="col">{`Today's P&L`}</th>
              <th scope="col" title="Percent of total portfolio market value (all accounts)">
                % of portfolio
              </th>
              <th scope="col">Qty</th>
              <th scope="col">Cost basis</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          {accountsVirtualize ? (
            <tbody>
              {(() => {
                const vItems = rowVirtualizer.getVirtualItems();
                const padTop = vItems.length > 0 ? vItems[0].start : 0;
                const padBottom =
                  vItems.length > 0 ? rowVirtualizer.getTotalSize() - vItems[vItems.length - 1]!.end : 0;
                return (
                  <>
                    {padTop > 0 ? (
                      <tr aria-hidden style={{ height: padTop }}>
                        <td colSpan={ACCOUNTS_TABLE_COLS} style={{ padding: 0, border: "none" }} />
                      </tr>
                    ) : null}
                    {vItems.map((vr) => {
                      const row = rows[vr.index]!;
                      return (
                        <PortfolioAccountTableDataRow
                          key={row.accountIdHex}
                          focusAccountId={focusAccountId}
                          portfolioIdHex={portfolioIdHex}
                          row={row}
                          totalAccounts={totalAccounts}
                          onSelectedAccountHexChange={onSelectedAccountHexChange}
                        />
                      );
                    })}
                    {padBottom > 0 ? (
                      <tr aria-hidden style={{ height: padBottom }}>
                        <td colSpan={ACCOUNTS_TABLE_COLS} style={{ padding: 0, border: "none" }} />
                      </tr>
                    ) : null}
                  </>
                );
              })()}
            </tbody>
          ) : (
            <tbody>
              {rows.map((row) => (
                <PortfolioAccountTableDataRow
                  key={row.accountIdHex}
                  focusAccountId={focusAccountId}
                  portfolioIdHex={portfolioIdHex}
                  row={row}
                  totalAccounts={totalAccounts}
                  onSelectedAccountHexChange={onSelectedAccountHexChange}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
