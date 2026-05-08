import { z } from "zod";

export const portfolioAlertUserPriceRuleMetadataV1Schema = z.object({
  v: z.literal(1),
  source: z.literal("xchat_user_price_rule"),
  ruleKind: z.enum(["above", "below", "crosses"]),
  targetPriceUsd: z.number().positive().max(1_000_000),
  /** Prior desk quote reference for crossing detection; undefined until first scanner observation. */
  lastReferencePrice: z.number().positive().optional(),
  ruleState: z.enum(["armed", "dismissed"]).default("armed"),
  delivery: z
    .object({
      channels: z.array(z.enum(["email"])).default(["email"]),
      /** Email uses desk SMTP + portfolio delivery channels when configured (same path as desk alerts). */
      pendingEmailDispatch: z.boolean().optional()
    })
    .default({ channels: ["email"], pendingEmailDispatch: true }),
  provenance: z.object({
    createdVia: z.literal("xchat_atx_function"),
    correlationHint: z.string().max(160).optional()
  })
});

export type PortfolioAlertUserPriceRuleMetadataV1 = z.infer<
  typeof portfolioAlertUserPriceRuleMetadataV1Schema
>;

export function parsePortfolioAlertUserPriceRuleMetadata(
  raw: unknown
): PortfolioAlertUserPriceRuleMetadataV1 | null {
  const parsed = portfolioAlertUserPriceRuleMetadataV1Schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
