import { describe, expect, it } from "vitest";

import {
    alertDteBucket,
    extractAlertQuantSnippet,
    inferAlertRiskKind,
    isOptionStyleAlert,
    parseAlertDte
} from "@/lib/portfolio-alert-insights";

describe("parseAlertDte", () => {
  it("reads N DTE from title or body", () => {
    expect(parseAlertDte("x", "Alert 6 DTE")).toBe(6);
    expect(parseAlertDte("DTE 14 remaining", "t")).toBe(14);
  });

  it("returns null when absent", () => {
    expect(parseAlertDte(null, "No dte here")).toBeNull();
  });
});

describe("alertDteBucket", () => {
  it("maps ranges", () => {
    expect(alertDteBucket(3)).toBe("0-7");
    expect(alertDteBucket(15)).toBe("8-21");
    expect(alertDteBucket(30)).toBe("22-45");
    expect(alertDteBucket(60)).toBe("46+");
    expect(alertDteBucket(null)).toBe("unknown");
  });
});

describe("extractAlertQuantSnippet", () => {
  it("combines DTE, P/L, IV when present", () => {
    const body = "6 DTE\nUnrealized -12.5% loss\nIV 42%";
    expect(extractAlertQuantSnippet(body, "t")).toContain("DTE 6");
    expect(extractAlertQuantSnippet(body, "t")).toContain("-12.5% P/L");
  });

  it("falls back to first content line", () => {
    expect(extractAlertQuantSnippet("First line only\nSecond", "short title")).toBe("First line only");
  });
});

describe("inferAlertRiskKind", () => {
  it("detects exit pressure", () => {
    expect(inferAlertRiskKind("info", "[close:BUY_TO_CLOSE]", "x")).toBe("exit_pressure");
  });

  it("detects income / theta", () => {
    expect(inferAlertRiskKind("warning", "roll forward for theta", "x")).toBe("income_theta");
  });

  it("maps critical without keywords to exit_pressure", () => {
    expect(inferAlertRiskKind("critical", null, "Generic")).toBe("exit_pressure");
  });
});

describe("isOptionStyleAlert", () => {
  it("true for scanner title, close tag, or afp", () => {
    expect(isOptionStyleAlert("Option scanner: TSLA", null)).toBe(true);
    expect(isOptionStyleAlert("x", "[close:SELL_TO_CLOSE]")).toBe(true);
    expect(isOptionStyleAlert("x", "[afp:SYM]")).toBe(true);
  });

  it("false for plain desk copy", () => {
    expect(isOptionStyleAlert("Cash low", "Add funds")).toBe(false);
  });
});
