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

export type EditAccountFormValues = z.infer<typeof editAccountFormSchema>;
