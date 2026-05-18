import { describe, expect, it } from "vitest";

import {
  buildOptionsScanArgsFromMessage,
  extractOptionsScanSymbol,
  parseDteRangeFromMessage,
  shouldRunDirectOptionsScan
} from "@/modules/xchat/options-scan-ask-routing";
import { shouldOfferStrategyJobPreflight } from "@/modules/xchat/xchat-ask-routing";

describe("options-scan-ask-routing", () => {
  it("matches xoptions CSP ideas with symbol and DTE range", () => {
    const msg = "xoptions CSP ideas for ASTS with 7-14 DTE";
    expect(shouldRunDirectOptionsScan(msg)).toBe(true);
    expect(shouldOfferStrategyJobPreflight(msg)).toBe(false);
    expect(extractOptionsScanSymbol(msg)).toBe("ASTS");
    expect(parseDteRangeFromMessage(msg)).toEqual({ minDte: 7, maxDte: 14 });
    const args = buildOptionsScanArgsFromMessage(msg);
    expect(args?.symbol).toBe("ASTS");
    expect(args?.optionType).toBe("put");
    expect(args?.minDte).toBe(7);
    expect(args?.maxDte).toBe(14);
  });

  it("does not match generic education", () => {
    expect(shouldRunDirectOptionsScan("what is a cash secured put")).toBe(false);
  });

  it("does not match portfolio-wide action scan template", () => {
    expect(shouldRunDirectOptionsScan("scan my options from holdings + watchlist")).toBe(false);
  });

  it("defers covered-call ideas without desk scan cues to strategy-job preflight", () => {
    const msg = "covered call ideas for RDW";
    expect(shouldRunDirectOptionsScan(msg)).toBe(false);
    expect(shouldOfferStrategyJobPreflight(msg)).toBe(true);
  });
});
