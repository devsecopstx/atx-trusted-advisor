import { describe, expect, it } from "vitest";

import {
    buildBrokerImportTaskOutput,
    validateMappingsAgainstAccounts
} from "@/modules/portfolio-import/app-broker-import-job";
import type { ParsedBrokerAccount } from "@/modules/portfolio-import/broker-holdings-import";

describe("app-broker-import-job", () => {
  it("buildBrokerImportTaskOutput summarizes rows", () => {
    const out = buildBrokerImportTaskOutput("t1", [{ accountRef: "A", label: "Acct", imported: 2, skippedNonStock: 1, deletedPrior: 3 }], "507f1f77bcf86cd799439011");
    expect(out).toContain("sync-broker:");
    expect(out).toContain("507f1f77bcf86cd799439011");
    expect(out).toContain("imported=2");
    expect(out).toContain("Acct");
  });

  it("validateMappingsAgainstAccounts rejects unknown account ids", () => {
    const parsed: ParsedBrokerAccount[] = [
      { accountRef: "X", label: "L", positions: [] }
    ];
    const err = validateMappingsAgainstAccounts(parsed, { X: "badid" }, new Set(["good"]));
    expect(err).toMatch(/not in this portfolio/);
  });

  it("validateMappingsAgainstAccounts rejects missing mapping", () => {
    const parsed: ParsedBrokerAccount[] = [{ accountRef: "X", label: "L", positions: [] }];
    const err = validateMappingsAgainstAccounts(parsed, {}, new Set());
    expect(err).toMatch(/Missing mapping/);
  });

  it("validateMappingsAgainstAccounts accepts complete mapping", () => {
    const parsed: ParsedBrokerAccount[] = [{ accountRef: "X", label: "L", positions: [] }];
    const err = validateMappingsAgainstAccounts(parsed, { X: "acc1" }, new Set(["acc1"]));
    expect(err).toBeNull();
  });
});
