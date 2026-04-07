import { describe, expect, it } from "vitest";

import { thresholdsAppliedRecord } from "@/lib/option-scanner-thresholds";
import {
    buildOptionsScannerAlertMetadata,
    portfolioAlertScannerMetadataV1Schema
} from "@/lib/portfolio-alert-scan-metadata";
import { DEFAULT_PORTFOLIO_SCORING_FACTORS } from "@/modules/core-admin/scoring-factors";

describe("buildOptionsScannerAlertMetadata", () => {
  it("produces schema-valid v1 payload", () => {
    const meta = buildOptionsScannerAlertMetadata({
      contractKey: "2026-01-17|100|call|short:position",
      closeKind: "BUY_TO_CLOSE",
      fingerprint: "fp-1",
      underlying: "TSLA",
      metrics: {
        dte: 5,
        mark: 1.2,
        pnlPct: -10,
        ivPct: 44,
        openInterest: 500,
        volume: 120,
        finalConfidence: 80,
        grokUsed: false
      },
      thresholdsApplied: thresholdsAppliedRecord({
        lossCutPctDefault: -55,
        profitTakePctDefault: 85,
        shortPutHighIvIvMinPct: 70,
        shortPutHighIvLossCutPct: -40,
        shortPutHighIvProfitTakePct: 70,
        minOpenInterestWarn: 25,
        minVolumeWarn: 5,
        veryShortDteDays: 3,
        shortDteGammaWatchDays: 7,
        shortDteGammaWatchPnlPctMin: 35
      }),
      scoringFactors: [...DEFAULT_PORTFOLIO_SCORING_FACTORS],
      maxAlertsPerRun: 5,
      dedupeKey: "pid:key:BUY_TO_CLOSE"
    });
    expect(meta).not.toBeNull();
    const parsed = portfolioAlertScannerMetadataV1Schema.safeParse(meta);
    expect(parsed.success).toBe(true);
  });
});
