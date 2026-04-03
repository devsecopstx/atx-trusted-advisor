import { describe, expect, it } from "vitest";

import { detectFidelityActivitiesCsv, parseFidelityActivitiesAccounts } from "@/modules/portfolio-import/fidelity-activities-csv";

const SAMPLE = `
Run Date,Account,Account Number,Action,Symbol,Description,Type,Exchange Quantity,Exchange Currency,Currency,Price,Quantity,Exchange Rate,Commission,Fees,Accrued Interest,Amount,Settlement Date
03/23/2026,"ROTH IRA","269138837","YOU BOUGHT ASSIGNED PUTS AS OF 03-20-26 REDWIRE CORPORATION COM (RDW) (Cash)",RDW,"REDWIRE CORPORATION COM",Cash,0,,USD,10,1100,0,,,,-11000,03/23/2026
04/01/2026,"ROTH IRA","269138837","YOU SOLD ASSIGNED CALLS AS OF 04-02-26 REDWIRE CORPORATION COM (RDW) (Cash)",RDW,"REDWIRE CORPORATION COM",Cash,0,,USD,8,-1000,0,,0.17,,7999.83,04/06/2026

"The data and information in this spreadsheet is provided to you solely for your use"
Date downloaded 04/03/2026 11:21 am
`;

describe("fidelity-activities-csv", () => {
  it("detects Accounts History layout", () => {
    expect(detectFidelityActivitiesCsv(SAMPLE)).toBe(true);
    expect(detectFidelityActivitiesCsv("Symbol,Quantity\nTSLA,10\n")).toBe(false);
  });

  it("parses account numbers, replays chronologically, and skips footer", () => {
    const { accounts, parseError } = parseFidelityActivitiesAccounts(SAMPLE);
    expect(parseError).toBeUndefined();
    expect(accounts.length).toBe(1);
    const roth = accounts[0]!;
    expect(roth.accountRef).toBe("269138837");
    const stock = roth.positions.find((p) => p.type === "stock" && p.ticker === "RDW");
    expect(stock?.type).toBe("stock");
    expect(stock?.shares).toBe(100);
  });
});
