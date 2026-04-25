import type { OptionsActionReport, OptionsActionReportRow } from "@/modules/xchat/options-action-scan";

export type OptionsActionScanDisplayData = {
  generatedAt: string;
  planTier: OptionsActionReport["planTier"];
  truncated: boolean;
  rows: OptionsActionReportRow[];
  disclaimer: string;
};
