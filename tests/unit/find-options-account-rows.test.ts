import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import type { Account } from "@/modules/core-admin/types";
import {
    buildFindOptionsAccountRows,
    resolveAccountOptionsApproved
} from "@/modules/find-options/find-options-service";

function baseAccount(overrides: Partial<Account> & { _id: ObjectId }): Account {
  return {
    userId: "u1",
    portfolioId: new ObjectId(),
    name: "Cash Management",
    type: "fidelity",
    extAccountId: "Z06276930",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("buildFindOptionsAccountRows / resolveAccountOptionsApproved", () => {
  it("maps Mongo accounts to API rows with ext id and desk fields", () => {
    const id = new ObjectId();
    const rows = buildFindOptionsAccountRows(
      [
        baseAccount({
          _id: id,
          name: "Cash Management",
          extAccountId: "Z06276930",
          isDefault: true,
          outlook: "bullish",
          riskProfile: "balanced"
        })
      ],
      false
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: id.toHexString(),
      name: "Cash Management",
      extAccountId: "••••6930",
      isDefault: true,
      optionsApproved: false,
      outlook: "bullish",
      riskProfile: "balanced"
    });
  });

  it("uses assume-all-approved when optionsTradingEnabled is unset", () => {
    const a = baseAccount({ _id: new ObjectId() });
    expect(resolveAccountOptionsApproved(a, false)).toBe(false);
    expect(resolveAccountOptionsApproved(a, true)).toBe(true);
  });

  it("honors explicit optionsTradingEnabled on the account document", () => {
    const forcedOff = baseAccount({
      _id: new ObjectId(),
      optionsTradingEnabled: false
    });
    expect(resolveAccountOptionsApproved(forcedOff, true)).toBe(false);
    const forcedOn = baseAccount({
      _id: new ObjectId(),
      optionsTradingEnabled: true
    });
    expect(resolveAccountOptionsApproved(forcedOn, false)).toBe(true);
  });

  it("drops accounts without _id", () => {
    const row = baseAccount({ _id: new ObjectId() });
    const noId = { ...row } as Account;
    delete noId._id;
    const rows = buildFindOptionsAccountRows([noId], true);
    expect(rows).toHaveLength(0);
  });
});
