import { BrokerIcon } from "@/components/brokers/BrokerIcon";
import type { BrokerIconSlug } from "@/lib/broker-ui";

export type PortfolioBrokerAccountMarkProps = {
  brokerTypeLabel: string;
  brokerIconSlug: BrokerIconSlug | null;
  extAccountRefMasked: string;
  /** Optional account display name above broker line. */
  accountName?: string;
  compact?: boolean;
};

export function PortfolioBrokerAccountMark({
  brokerTypeLabel,
  brokerIconSlug,
  extAccountRefMasked,
  accountName,
  compact = false
}: PortfolioBrokerAccountMarkProps) {
  const refDisplay = extAccountRefMasked.trim() || "—";

  return (
    <div
      className={`portfolio-broker-account-mark${compact ? " portfolio-broker-account-mark--compact" : ""}`}
      title={`${brokerTypeLabel} · ref ${refDisplay}`}
    >
      {accountName ? <p className="portfolio-broker-account-mark__account">{accountName}</p> : null}
      <div className="portfolio-manage-table__broker-row portfolio-broker-account-mark__broker-row">
        {brokerIconSlug ? (
          <BrokerIcon
            broker={brokerIconSlug}
            size={compact ? 20 : 22}
            showTooltip={false}
            className="portfolio-manage-table__broker-mark"
          />
        ) : (
          <span className="portfolio-manage-table__broker-fallback" title={brokerTypeLabel} aria-hidden>
            {brokerTypeLabel.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="portfolio-manage-table__broker-label">{brokerTypeLabel}</span>
      </div>
      <p className="portfolio-manage-table__ref portfolio-broker-account-mark__ref">{refDisplay}</p>
    </div>
  );
}
