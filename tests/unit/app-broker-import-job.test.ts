import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import type { Account } from "@/modules/core-admin/types";
import { buildBrokerImportTaskOutput, validateBrokerImportMappings } from "@/modules/portfolio-import/app-broker-import-job";
import type { ParsedBrokerAccount } from "@/modules/portfolio-import/broker-holdings-import";

const OID_A = "507f1f77bcf86cd7994390aa";
const OID_B = "507f1f77bcf86cd7994390bb";

function mockAccount(idHex: string, type: "merrill" | "fidelity", ext: string): Account {
  const now = new Date();
  return {
    _id: new ObjectId(idHex),
    userId: "user-1",
    portfolioId: new ObjectId(),
    name: "Acct",
    type,
    extAccountId: ext,
    isDefault: false,
    createdAt: now,
    updatedAt: now
  };
}

describe("app-broker-import-job", () => {
  it("buildBrokerImportTaskOutput summarizes rows", () => {
    const out = buildBrokerImportTaskOutput(
      "t1",
      [{ accountRef: "A", label: "Acct", imported: 2, skippedNonStock: 1, deletedPrior: 3 }],
      "507f1f77bcf86cd799439011"
    );
    expect(out).toContain("sync-broker:");
    expect(out).toContain("507f1f77bcf86cd799439011");
    expect(out).toContain("imported=2");
    expect(out).toContain("Acct");
  });

  it("validateBrokerImportMappings rejects unknown account ids", () => {
    const parsed: ParsedBrokerAccount[] = [{ accountRef: "X", label: "L", positions: [] }];
    const err = validateBrokerImportMappings(parsed, { X: "badid" }, [mockAccount(OID_A, "merrill", "X")], "merrill");
    expect(err).toMatch(/not in this portfolio/);
  });

  it("validateBrokerImportMappings rejects when no broker account is selected", () => {
    const parsed: ParsedBrokerAccount[] = [{ accountRef: "X", label: "L", positions: [] }];
    const err = validateBrokerImportMappings(parsed, {}, [mockAccount(OID_A, "merrill", "X")], "merrill");
    expect(err).toMatch(/at least one/i);
  });

  it("validateBrokerImportMappings allows omitting rows (partial import)", () => {
    const parsed: ParsedBrokerAccount[] = [
      { accountRef: "X", label: "L1", positions: [] },
      { accountRef: "Y", label: "L2", positions: [] }
    ];
    const err = validateBrokerImportMappings(
      parsed,
      { X: OID_A },
      [mockAccount(OID_A, "merrill", "X"), mockAccount(OID_B, "merrill", "Y")],
      "merrill"
    );
    expect(err).toBeNull();
  });

  it("validateBrokerImportMappings accepts matching broker type and ext ref", () => {
    const parsed: ParsedBrokerAccount[] = [{ accountRef: "X", label: "L", positions: [] }];
    const err = validateBrokerImportMappings(
      parsed,
      { X: OID_A },
      [mockAccount(OID_A, "merrill", "X")],
      "merrill"
    );
    expect(err).toBeNull();
  });

  it("validateBrokerImportMappings rejects broker type mismatch", () => {
    const parsed: ParsedBrokerAccount[] = [{ accountRef: "X", label: "L", positions: [] }];
    const err = validateBrokerImportMappings(
      parsed,
      { X: OID_A },
      [mockAccount(OID_A, "fidelity", "X")],
      "merrill"
    );
    expect(err).toMatch(/broker type/);
  });

  it("validateBrokerImportMappings rejects ext ref mismatch", () => {
    const parsed: ParsedBrokerAccount[] = [{ accountRef: "X", label: "L", positions: [] }];
    const err = validateBrokerImportMappings(
      parsed,
      { X: OID_A },
      [mockAccount(OID_A, "merrill", "WRONG")],
      "merrill"
    );
    expect(err).toMatch(/Account ref mismatch/);
  });

  it("validateBrokerImportMappings accepts last-4 broker ref vs full extAccountId", () => {
    const parsed: ParsedBrokerAccount[] = [{ accountRef: "5678", label: "L", positions: [] }];
    const err = validateBrokerImportMappings(
      parsed,
      { "5678": OID_A },
      [mockAccount(OID_A, "merrill", "12345678")],
      "merrill"
    );
    expect(err).toBeNull();
  });

  it("validateBrokerImportMappings rejects when same id maps but second parsed row expects different ext", () => {
    const parsed: ParsedBrokerAccount[] = [
      { accountRef: "X", label: "L1", positions: [] },
      { accountRef: "Y", label: "L2", positions: [] }
    ];
    const err = validateBrokerImportMappings(
      parsed,
      { X: OID_A, Y: OID_A },
      [mockAccount(OID_A, "merrill", "X")],
      "merrill"
    );
    expect(err).toMatch(/Account ref mismatch/);
  });

  it("validateBrokerImportMappings accepts two accounts with distinct refs", () => {
    const parsed: ParsedBrokerAccount[] = [
      { accountRef: "X", label: "L1", positions: [] },
      { accountRef: "Y", label: "L2", positions: [] }
    ];
    const err = validateBrokerImportMappings(
      parsed,
      { X: OID_A, Y: OID_B },
      [mockAccount(OID_A, "merrill", "X"), mockAccount(OID_B, "merrill", "Y")],
      "merrill"
    );
    expect(err).toBeNull();
  });
});
