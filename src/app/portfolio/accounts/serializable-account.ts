import type { AccountOutlook } from "@/modules/core-admin/types";

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
  /** After broker CSV import, ref + broker cannot change (app user). */
  brokerImportLocked: boolean;
  riskProfile: "conservative" | "balanced" | "growth" | null;
  outlook: AccountOutlook | null;
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
