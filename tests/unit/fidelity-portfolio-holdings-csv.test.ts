import { describe, expect, it } from "vitest";

import {
    detectFidelityPortfolioHoldingsCsv,
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

"The data and information in this spreadsheet is provided to you solely for your use"
`;

describe("fidelity-portfolio-holdings-csv", () => {
  it("detects Portfolio / multi-account positions layout and rejects Accounts History", () => {
    expect(detectFidelityPortfolioHoldingsCsv(SAMPLE)).toBe(true);
    expect(
      detectFidelityPortfolioHoldingsCsv(
        "Run Date,Account Number,Action\n03/01/2026,123,YOU BOUGHT\n"
      )
    ).toBe(false);
  });

  it("parses multiple accounts, skips sweep cash and pending rows", () => {
    const asOf = new Date("2026-04-03T12:00:00Z");
    const { accounts, parseError } = parseFidelityPortfolioHoldingsCsv(SAMPLE, asOf);
    expect(parseError).toBeUndefined();
    expect(accounts.length).toBe(3);

    const byRef = new Map(accounts.map((a) => [a.accountRef, a]));
    expect(byRef.get("X65430196")?.positions.find((p) => p.type === "stock" && p.ticker === "RDW")?.shares).toBe(1500);
    expect(byRef.get("221238941")?.positions.find((p) => p.ticker === "TSLA")?.shares).toBe(501);
    expect(byRef.get("269138837")?.positions.find((p) => p.ticker === "RDW")?.shares).toBe(100);
  });
});
