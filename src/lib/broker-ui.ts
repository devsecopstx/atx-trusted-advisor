import { accountTypeValues, type AccountType } from "@/modules/core-admin/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  merrill: "Merrill",
  fidelity: "Fidelity",
  etrade: "E*TRADE",
  ibkr: "Interactive Brokers (IBKR)"
};

/** Public static paths (see `public/brokers/`, aligned with admin broker catalog seeds). */
export const BROKER_ICON_URL: Record<AccountType, string> = {
  merrill: "/brokers/merrill-edge.png",
  fidelity: "/brokers/fidelity.png",
  etrade: "/brokers/etrade.png",
  ibkr: "/brokers/ibkr.png"
};

export function brokerIconUrlForType(slug: string): string | null {
  if ((accountTypeValues as readonly string[]).includes(slug)) {
    return BROKER_ICON_URL[slug as AccountType];
  }
  return null;
}

export function formatBrokerTypeLabel(type: string): string {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
