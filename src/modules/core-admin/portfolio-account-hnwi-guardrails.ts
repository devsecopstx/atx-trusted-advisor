import { z } from "zod";

import type { PortfolioAccountHnwiGuardrails } from "@/modules/core-admin/types";

/** PATCH body fragment: each field optional; `null` removes that key from stored guardrails. */
export const hnwiGuardrailsPartialSchema = z
  .object({
    taxTreatment: z.enum(["taxable", "tax_advantaged"]).nullable().optional(),
    maxPositionPctOfEquity: z.number().min(0.01).max(1).nullable().optional(),
    marginRule: z.enum(["cash_only", "limited_margin", "full_margin"]).nullable().optional(),
    taxLotMatching: z
      .enum(["fifo", "lifo", "specific_identification", "highest_cost"])
      .nullable()
      .optional(),
    minLiquidityCashPctOfEquity: z.number().min(0).max(1).nullable().optional(),
    minLiquidityMonthsExpenses: z.number().min(0).max(600).nullable().optional()
  })
  .strict();

export type HnwiGuardrailsPatchPayload = z.infer<typeof hnwiGuardrailsPartialSchema>;

export function mergePortfolioAccountHnwiGuardrails(
  existing: PortfolioAccountHnwiGuardrails | null | undefined,
  patch: HnwiGuardrailsPatchPayload
): PortfolioAccountHnwiGuardrails | null {
  const base: Record<string, unknown> = { ...(existing ?? {}) };
  (Object.keys(patch) as (keyof HnwiGuardrailsPatchPayload)[]).forEach((key) => {
    const val = patch[key];
    if (val === undefined) {
      return;
    }
    if (val === null) {
      delete base[key];
    } else {
      base[key] = val;
    }
  });
  return Object.keys(base).length === 0 ? null : (base as PortfolioAccountHnwiGuardrails);
}
