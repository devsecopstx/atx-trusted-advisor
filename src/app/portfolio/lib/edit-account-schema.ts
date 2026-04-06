import { z } from "zod";

import { accountOutlookValues, accountTypeValues } from "@/modules/core-admin/types";

const deskRiskEnum = z.enum(["conservative", "balanced", "growth"]);

export const editAccountFormSchema = z.object({
  name: z.string().trim().min(1, "Account name is required.").max(80, "Use at most 80 characters."),
  extAccountId: z.string().trim().min(1, "Account ref is required."),
  type: z.enum(accountTypeValues),
  cashBalance: z.number().finite().nonnegative(),
  outlook: z.enum(accountOutlookValues),
  riskProfile: deskRiskEnum
});

/** When the account ref is already stored, the client does not send `extAccountId` (read-only + masked in UI). */
export const editAccountFormSchemaWithoutExtRef = z.object({
  name: z.string().trim().min(1, "Account name is required.").max(80, "Use at most 80 characters."),
  type: z.enum(accountTypeValues),
  cashBalance: z.number().finite().nonnegative(),
  outlook: z.enum(accountOutlookValues),
  riskProfile: deskRiskEnum
});

export type EditAccountFormValues = z.infer<typeof editAccountFormSchema>;
export type EditAccountFormValuesWithoutExtRef = z.infer<typeof editAccountFormSchemaWithoutExtRef>;
