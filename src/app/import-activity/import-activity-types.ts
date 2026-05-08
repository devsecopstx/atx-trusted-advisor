export type BrokerPreviewAccount = {
  accountRef: string;
  label: string;
  positionCount: number;
  stockCount: number;
  optionCount: number;
  cashCount: number;
  sampleTickers: string[];
  estimatedBalanceUsd: number;
};

/** Must match `parseBrokerHoldingsAccounts` / `applyBrokerHoldingsToMappedAccounts` mapping keys. */
export function brokerImportPreviewRowKey(row: BrokerPreviewAccount): string {
  return row.accountRef || row.label || "default";
}
