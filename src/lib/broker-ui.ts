import { accountTypePickerValues, accountTypeValues, type AccountType } from "@/modules/core-admin/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  fidelity: "Fidelity",
  merrill: "Merrill",
  ibkr: "IBKR",
  schwab: "Schwab",
  other: "Other",
  etrade: "E*TRADE"
};

/** Order for add/edit account broker dropdowns (legacy `etrade` rows still resolve via {@link ACCOUNT_TYPE_LABELS}). */
export const ACCOUNT_TYPE_PICKER_ORDER: readonly AccountType[] = accountTypePickerValues;

/** Public static paths (see `public/brokers/`, aligned with admin broker catalog seeds). */
export const BROKER_ICON_URL: Record<AccountType, string> = {
  merrill: "/brokers/merrill-edge.png",
  fidelity: "/brokers/fidelity.png",
  ibkr: "/brokers/ibkr.png",
  schwab: "/brokers/fidelity.png",
  other: "/brokers/fidelity.png",
  etrade: "/brokers/etrade.png"
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
