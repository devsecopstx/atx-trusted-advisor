import { describe, expect, it } from "vitest";

import {
    detectFidelityActivitiesCsv,
    fidelityActivityReplaySeedFromBrokerPositions,
    parseFidelityActivitiesAccounts,
    replayFidelityActivityRows
} from "@/modules/portfolio-import/fidelity-activities-csv";

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

  it("omits options expired on or before the latest Run Date in the export (e.g. EXPIRED PUT as of that day)", () => {
    const csv = `
Run Date,Account,Account Number,Action,Symbol,Description,Type,Exchange Quantity,Exchange Currency,Currency,Price,Quantity,Exchange Rate,Commission,Fees,Accrued Interest,Amount,Settlement Date
04/01/2026,"ROTH IRA","269138837","YOU BOUGHT OPTION",-RDW260415C00010000,"","",,,USD,0.25,2,,,,,,
04/03/2026,"ROTH IRA","269138837","EXPIRED PUT (RDW) APR 02 26",-RDW260402P00007500,"","",,,USD,0.10,3,,,,,,
"The data and information in this spreadsheet is provided to you solely for your use"
`;
    const { accounts, parseError } = parseFidelityActivitiesAccounts(csv);
    expect(parseError).toBeUndefined();
    expect(accounts.length).toBe(1);
    const pos = accounts[0]!.positions;
    const longDated = pos.find((p) => p.type === "option" && p.expiration === "2026-04-15");
    expect(longDated?.type).toBe("option");
    expect(longDated?.contracts).toBe(2);
    const expiredLeg = pos.find((p) => p.type === "option" && p.expiration === "2026-04-02");
    expect(expiredLeg).toBeUndefined();
  });

  it("replays activities on top of existing holdings seed (merge)", () => {
    const seed = fidelityActivityReplaySeedFromBrokerPositions([
      { type: "stock", symbol: "RDW", qty: 50, avgCost: 8 },
      { type: "cash", symbol: "SPAXX", qty: 1, avgCost: 1000 }
    ]);
    const rows = [
      {
        sortKey: 1,
        lineIndex: 1,
        runIsoYmd: "2026-04-01",
        accountNumber: "269138837",
        accountName: "ROTH",
        action: "YOU BOUGHT",
        symbol: "RDW",
        price: 10,
        quantity: 100
      }
    ];
    const merged = replayFidelityActivityRows(rows, seed);
    const stock = merged.find((p) => p.type === "stock" && p.ticker === "RDW");
    expect(stock?.shares).toBe(150);
    const cash = merged.find((p) => p.type === "cash" && p.ticker === "SPAXX");
    expect(cash?.purchasePrice).toBe(1000);
  });
});
