import { z } from "zod";

/** Sample row for import preview grid (subset of parsed holdings). */
export const brokerImportPreviewSampleRowSchema = z.object({
  accountLabel: z.string(),
  accountRefLast4: z.string(),
  symbol: z.string(),
  qty: z.string(),
  avgCost: z.string(),
  last: z.string(),
  value: z.string(),
  rowType: z.enum(["stock", "option", "cash"])
});

export const brokerImportCsvStatsSchema = z.object({
  nonEmptyLines: z.number().int().nonnegative(),
  totalPositionsParsed: z.number().int().nonnegative()
});

export const brokerImportDryRunAccountPreviewSchema = z.object({
  accountRef: z.string(),
  label: z.string(),
  positionCount: z.number().int().nonnegative(),
  stockCount: z.number().int().nonnegative(),
  optionCount: z.number().int().nonnegative(),
  cashCount: z.number().int().nonnegative(),
  sampleTickers: z.array(z.string()),
  estimatedBalanceUsd: z.number().finite()
});

/**
 * `POST /api/import/broker` and `POST /api/admin/import/broker` body — dry-run success payload extensions.
 */
export const brokerImportDryRunResponseSchema = z.object({
  dryRun: z.literal(true),
  broker: z.string(),
  exportType: z.enum(["holdings"]),
  accounts: z.array(brokerImportDryRunAccountPreviewSchema),
  csvStats: brokerImportCsvStatsSchema,
  sampleRows: z.array(brokerImportPreviewSampleRowSchema),
  previewWarnings: z.array(z.string())
});

export type BrokerImportDryRunResponse = z.infer<typeof brokerImportDryRunResponseSchema>;
