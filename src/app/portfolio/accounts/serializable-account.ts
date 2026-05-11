import type { AccountOutlook, PortfolioAccountHnwiGuardrails } from "@/modules/core-admin/types";

export type SerializableAccount = {
  _id: string;
  name: string;
  type: string;
  /** Masked broker ref (last 4 only). Full value is never sent to the client once set. */
  extAccountRefMasked: string;
  /** True when a non-empty ref exists in the database. */
  hasExtAccountRef: boolean;
  cashBalance: number;
  isDefault: boolean;
  /** After broker CSV import, broker type cannot change; account ref remains editable. */
  brokerImportLocked: boolean;
  riskProfile: "conservative" | "balanced" | "growth" | null;
  outlook: AccountOutlook | null;
  /** Per-account opt-in for outlook refresh pipelines; default true when omitted. */
  outlookRefreshEnabled: boolean;
  lastOutlookRefreshAt: string | null;
  outlookRefreshSource: string | null;
  outlookConfidence: number | null;
  outlookNotes: string | null;
  hnwiGuardrails: PortfolioAccountHnwiGuardrails | null;
};

export type SerializableStockPosition = {
  _id: string;
  type: "stock";
  symbol: string;
  shares: number;
  purchasePrice: number;
};

export type SerializableCashPosition = {
  _id: string;
  type: "cash";
  label: string;
  amount: number;
  amountFormatted: string;
};

export type SerializableOptionPosition = {
  _id: string;
  type: "option";
  symbol: string;
  yahooRef: string;
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  contracts: number;
  premiumPerContract: number;
};

export type SerializablePosition =
  | SerializableStockPosition
  | SerializableCashPosition
  | SerializableOptionPosition;
