import { z } from "zod";

import { parseAccountOutlook, type AccountOutlook } from "@/modules/core-admin/types";

const outlookRequestValues = ["bullish", "neutral", "bearish", "up", "down", "flat"] as const;

/**
 * POST/PATCH body: accepts canonical slugs plus up / down / flat aliases; persists bullish | neutral | bearish.
 */
export const portfolioOutlookRequestSchema = z
  .union([z.enum(outlookRequestValues), z.null()])
  .optional()
  .transform((v): AccountOutlook | null | undefined => {
    if (v === undefined) {
      return undefined;
    }
    if (v === null) {
      return null;
    }
    const c = parseAccountOutlook(v);
    return c ?? undefined;
  });
