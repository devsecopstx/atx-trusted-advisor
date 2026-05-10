import { describe, expect, it } from "vitest";

import {
    estimatedBalanceAfterHoldingsImportUsd,
    parseBrokerHoldingsAccounts,
    previewBrokerHoldingsAccounts
} from "@/modules/portfolio-import/broker-holdings-import";
import {
    detectFidelityPortfolioHoldingsCsv,
    parseFidelityOptionSymbol,
    parseFidelityPortfolioHoldingsCsv
} from "@/modules/portfolio-import/fidelity-holdings-csv";

const SAMPLE = `
Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Today's Gain/Loss Dollar,Today's Gain/Loss Percent,Total Gain/Loss Dollar,Total Gain/Loss Percent,Percent Of Account,Cost Basis Total,Average Cost Basis,Type
X65430196,Individual - TOD,FCASH**,HELD IN FCASH,,,,$105.46,,,,,0.72%,,,Cash,
X65430196,Individual - TOD,RDW,REDWIRE CORPORATION COM,1500,$9.73,+$0.65,$14595.00,+$975.00,+7.15%,+$529.91,+3.77%,99.28%,$14065.09,$9.38,Margin,
221238941,Rollover IRA,SPAXX**,HELD IN MONEY MARKET,,,,$10562.07,,,,,5.39%,,,Cash,
221238941,Rollover IRA,LUNR,INTUITIVE MACHINES INC CLASS A COM,200,$23.99,+$3.75,$4798.00,+$750.00,+18.52%,+$1402.68,+41.31%,2.45%,$3395.32,$16.98,Cash,
221238941,Rollover IRA,TSLA,TESLA INC COM,501,$360.59,-$20.67,$180655.59,-$10355.67,-5.43%,+$67937.96,+60.27%,92.16%,$112717.63,$224.99,Cash,
269138837,ROTH IRA,SPAXX**,HELD IN MONEY MARKET,,,,$2630.75,,,,,22.67%,,,Cash,
269138837,ROTH IRA,RDW,REDWIRE CORPORATION COM,100,$9.73,+$0.65,$973.00,--,--,--,--,8.39%,--,--,Cash,
269138837,ROTH IRA,Pending activity,,,,,$7999.83,,,,,,,,,
Z06276930,Cash Management (Joint WROS - TOD),CORE**,FDIC-INSURED DEPOSIT SWEEP,,,,$123.07,,,,,213.66%,,,Cash,
Z06276930,Cash Management (Joint WROS - TOD),Pending activity,,,,,-$65.47,,,,,,,,,

"The data and information in this spreadsheet is provided to you solely for your use"
`;

/** OCC 8-digit strike (×1000) — common Fidelity Portfolio export; previously parsed as equity and skipped options apply. */
const SAMPLE_WITH_OPTION_OCC = `
Account Number,Account Name,Symbol,Description,Quantity,Last Price,Average Cost Basis,Current Value,Type
221238941,Rollover IRA,TSLA 260515C00350000,TESLA INC CALL 05/15/2026 $350.00,2,$12.34,$10.00,$2468.00,Margin
221238941,Rollover IRA,TSLA260515P00320000,TESLA INC PUT 05/15/2026 $320.00,-4,$2.10,$2.50,$840.00,Margin
`;

describe("fidelity-portfolio-holdings-csv", () => {
  it("parses OCC option symbols with 8-digit strike encoding and embedded spaces", () => {
    expect(parseFidelityOptionSymbol("TSLA260515C00350000")).toEqual({
      underlying: "TSLA",
      expiration: "2026-05-15",
      optionType: "call",
      strike: 350
    });
    expect(parseFidelityOptionSymbol("TSLA 260515C00350000")).toEqual({
      underlying: "TSLA",
      expiration: "2026-05-15",
      optionType: "call",
      strike: 350
    });
    expect(parseFidelityOptionSymbol("ABCDEF260620P00180000")).toEqual({
      underlying: "ABCDEF",
      expiration: "2026-06-20",
      optionType: "put",
      strike: 180
    });
  });

  it("preserves decimal strike after C/P (e.g. VELO $12.50 put) — dots only stripped from root", () => {
    expect(parseFidelityOptionSymbol("VELO260515P12.50")).toMatchObject({
      underlying: "VELO",
      expiration: "2026-05-15",
      optionType: "put",
      strike: 12.5
    });
    expect(parseFidelityOptionSymbol("VELO 260515P12.50")).toMatchObject({
      underlying: "VELO",
      strike: 12.5
    });
    expect(parseFidelityOptionSymbol("BRK.B260515C00150000")).toMatchObject({
      underlying: "BRKB",
      optionType: "call",
      strike: 150
    });
  });

  it("parses Portfolio CSV option row into option position", () => {
    const asOf = new Date("2026-05-10T12:00:00Z");
    const { accounts, parseError } = parseFidelityPortfolioHoldingsCsv(SAMPLE_WITH_OPTION_OCC, asOf);
    expect(parseError).toBeUndefined();
    const acc = accounts.find((a) => a.accountRef === "221238941");
    expect(acc).toBeDefined();
    const opt = acc!.positions.find((p) => p.type === "option");
    expect(opt).toMatchObject({
      type: "option",
      ticker: "TSLA",
      contracts: 2,
      optionType: "call",
      strike: 350,
      expiration: "2026-05-15"
    });
    const shortPut = acc!.positions.find((p) => p.type === "option" && p.optionType === "put");
    expect(shortPut).toMatchObject({
      type: "option",
      ticker: "TSLA",
      contracts: -4,
      optionType: "put",
      strike: 320,
      expiration: "2026-05-15"
    });
  });

  it("detects Portfolio / multi-account positions layout and rejects Accounts History", () => {
    expect(detectFidelityPortfolioHoldingsCsv(SAMPLE)).toBe(true);
    expect(
      detectFidelityPortfolioHoldingsCsv(
        "Run Date,Account Number,Action\n03/01/2026,123,YOU BOUGHT\n"
      )
    ).toBe(false);
  });

  it("parses stocks, sweep cash (Current Value), and skips pending rows", () => {
    const asOf = new Date("2026-04-03T12:00:00Z");
    const { accounts, parseError } = parseFidelityPortfolioHoldingsCsv(SAMPLE, asOf);
    expect(parseError).toBeUndefined();
    expect(accounts.length).toBe(4);

    const byRef = new Map(accounts.map((a) => [a.accountRef, a]));
    expect(byRef.get("X65430196")?.positions.find((p) => p.type === "stock" && p.ticker === "RDW")?.shares).toBe(1500);
    expect(byRef.get("X65430196")?.positions.find((p) => p.type === "cash" && p.ticker === "FCASH")?.purchasePrice).toBe(
      105.46
    );
    expect(byRef.get("221238941")?.positions.find((p) => p.ticker === "TSLA")?.shares).toBe(501);
    expect(byRef.get("221238941")?.positions.find((p) => p.type === "cash" && p.ticker === "SPAXX")?.purchasePrice).toBe(
      10562.07
    );
    expect(byRef.get("269138837")?.positions.find((p) => p.ticker === "RDW")?.shares).toBe(100);
    expect(byRef.get("269138837")?.positions.find((p) => p.type === "cash" && p.ticker === "SPAXX")?.purchasePrice).toBe(
      2630.75
    );
    expect(byRef.get("Z06276930")?.positions.find((p) => p.type === "cash" && p.ticker === "CORE")?.purchasePrice).toBe(
      123.07
    );
  });

  it("dry-run estimated balance sums CSV Current Value per account (parseBrokerHoldingsAccounts + preview)", () => {
    const asOf = new Date("2026-04-03T12:00:00Z");
    const { accounts, parseError } = parseBrokerHoldingsAccounts("fidelity", SAMPLE, "", {
      fidelityPortfolioAsOf: asOf
    });
    expect(parseError).toBeUndefined();
    const previews = previewBrokerHoldingsAccounts(accounts);
    const bal = (ref: string) => previews.find((p) => p.accountRef === ref)?.estimatedBalanceUsd;
    expect(bal("X65430196")).toBeCloseTo(105.46 + 14595, 2);
    expect(bal("221238941")).toBeCloseTo(10562.07 + 4798 + 180655.59, 2);
    expect(bal("269138837")).toBeCloseTo(2630.75 + 973, 2);
    expect(bal("Z06276930")).toBeCloseTo(123.07, 2);
    const x = accounts.find((a) => a.accountRef === "X65430196")?.positions ?? [];
    expect(estimatedBalanceAfterHoldingsImportUsd(x)).toBeCloseTo(105.46 + 14595, 2);
  });
});
