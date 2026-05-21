import { accountTypePickerValues, type AccountType } from "@/modules/core-admin/types";

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

/** Slugs with built-in SVG marks in `BrokerIcon` (aligned with broker catalog seeds). */
export const brokerIconSlugValues = [
  "fidelity",
  "etrade",
  "forge",
  "hiive",
  "ibkr",
  "merrill"
] as const;
export type BrokerIconSlug = (typeof brokerIconSlugValues)[number];

export function brokerIconSlugFromCatalogType(type: string): BrokerIconSlug | null {
  const slug = type.trim().toLowerCase();
  if ((brokerIconSlugValues as readonly string[]).includes(slug)) {
    return slug as BrokerIconSlug;
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
