import { describe, expect, it } from "vitest";

import type { ParsedBrokerAccount } from "@/modules/portfolio-import/broker-holdings-import";
import {
    brokerImportCsvStatsFromParsed,
    buildBrokerImportPreviewSampleRows,
    collectBrokerImportPreviewWarnings,
    countCsvNonEmptyLines
} from "@/modules/portfolio-import/broker-import-dry-run-preview";

describe("broker-import-dry-run-preview", () => {
  it("counts non-empty CSV lines", () => {
    expect(countCsvNonEmptyLines("a\n\nb")).toBe(2);
    expect(countCsvNonEmptyLines("\r\nx\r\n")).toBe(1);
  });

  it("builds capped sample rows with account labels and types", () => {
    const accounts: ParsedBrokerAccount[] = [
      {
        accountRef: "ABC-12345",
        label: "Individual",
        positions: [
          { type: "stock", ticker: "TSLA", shares: 10, purchasePrice: 100 },
          {
            type: "option",
            ticker: "AAPL",
            contracts: 2,
            premium: 1.5,
            optionType: "call",
            strike: 200,
            expiration: "2030-01-17",
            lastPriceUsd: 1.55
          }
        ]
      }
    ];
    const rows = buildBrokerImportPreviewSampleRows(accounts, 10);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.rowType).toBe("stock");
    expect(rows[0]?.qty).toContain("10");
    expect(rows[1]?.rowType).toBe("option");
    expect(rows[1]?.last).toMatch(/\$1\.55/);
  });

  it("aggregates csv stats from parsed accounts", () => {
    const csv = "h\nr1\nr2";
    const accounts: ParsedBrokerAccount[] = [
      { accountRef: "x", label: "L", positions: [{ type: "stock", ticker: "X", shares: 1 }] }
    ];
    const stats = brokerImportCsvStatsFromParsed(csv, accounts);
    expect(stats.nonEmptyLines).toBe(3);
    expect(stats.totalPositionsParsed).toBe(1);
  });

  it("warns on negative option contracts", () => {
    const accounts: ParsedBrokerAccount[] = [
      {
        accountRef: "z",
        label: "Z",
        positions: [{ type: "option", ticker: "QQQ", contracts: -1, premium: 2, optionType: "put", strike: 400, expiration: "2030-06-20" }]
      }
    ];
    const w = collectBrokerImportPreviewWarnings(accounts);
    expect(w.some((x) => x.toLowerCase().includes("short"))).toBe(true);
  });
});
