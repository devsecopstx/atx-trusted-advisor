import { BrokerIcon } from "@/components/brokers/BrokerIcon";
import type { BrokerIconSlug } from "@/lib/broker-ui";

export type PortfolioBrokerAccountMarkProps = {
  brokerTypeLabel: string;
  brokerIconSlug: BrokerIconSlug | null;
  extAccountRefMasked: string;
  /** Optional account display name above broker line. */
  accountName?: string;
  compact?: boolean;
  /** Account selector rail: icon + ref only (no duplicate broker label when SVG mark exists). */
  selector?: boolean;
};

export function PortfolioBrokerAccountMark({
  brokerTypeLabel,
  brokerIconSlug,
  extAccountRefMasked,
  accountName,
  compact = false,
  selector = false
}: PortfolioBrokerAccountMarkProps) {
  const refDisplay = extAccountRefMasked.trim() || "—";
  const showBrokerLabel = !selector || !brokerIconSlug;

  return (
    <div
      className={[
        "portfolio-broker-account-mark",
        compact ? "portfolio-broker-account-mark--compact" : "",
        selector ? "portfolio-broker-account-mark--selector" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      title={`${brokerTypeLabel} · ref ${refDisplay}`}
    >
      {accountName ? <p className="portfolio-broker-account-mark__account">{accountName}</p> : null}
      <div className="portfolio-manage-table__broker-row portfolio-broker-account-mark__broker-row">
        {brokerIconSlug ? (
          <BrokerIcon
            broker={brokerIconSlug}
            size={selector ? 24 : compact ? 20 : 22}
            showTooltip={false}
            className="portfolio-manage-table__broker-mark portfolio-broker-account-mark__icon"
          />
        ) : (
          <span className="portfolio-manage-table__broker-fallback" title={brokerTypeLabel} aria-hidden>
            {brokerTypeLabel.slice(0, 2).toUpperCase()}
          </span>
        )}
        {showBrokerLabel ? (
          <span className="portfolio-manage-table__broker-label">{brokerTypeLabel}</span>
        ) : (
          <span className="sr-only">{brokerTypeLabel}</span>
        )}
        {selector ? (
          <span className="portfolio-manage-table__ref portfolio-broker-account-mark__ref-inline">{refDisplay}</span>
        ) : null}
      </div>
      {!selector ? (
        <p className="portfolio-manage-table__ref portfolio-broker-account-mark__ref">{refDisplay}</p>
      ) : null}
    </div>
  );
}
