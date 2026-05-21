import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd());

describe("portfolio holdings position desk actions contract", () => {
  it("does not register account-level Options Chain tab on /portfolio manage shell", () => {
    const tabs = readFileSync(join(ROOT, "src/app/portfolio/ui/portfolio-manage-tabs.tsx"), "utf8");
    expect(tabs).not.toContain('"options-chain"');
    expect(tabs).not.toContain("Options Chain");

    const shell = readFileSync(join(ROOT, "src/app/portfolio/ui/portfolio-manage-shell.tsx"), "utf8");
    expect(shell).not.toContain("OptionsChainTab");
    expect(shell).not.toContain("optionsChainPanel");
  });

  it("does not register Options Chain tab on account edit workspace", () => {
    const src = readFileSync(
      join(ROOT, "src/app/portfolio/accounts/[accountId]/account-workspace-client.tsx"),
      "utf8"
    );
    expect(src).not.toContain("options-chain");
    expect(src).not.toContain("OptionsChainTab");
    expect(src).toContain('type EditTab = "account" | "holdings"');
  });

  it("wires per-position desk actions in consolidated holdings table", () => {
    const table = readFileSync(
      join(ROOT, "src/app/portfolio/ui/account-consolidated-holdings-table.tsx"),
      "utf8"
    );
    expect(table).toContain("PositionOptionsChainDrawer");
    expect(table).toContain("isPositionOptionsChainEligible");
    expect(table).toContain("buildPositionDeskHandoffUrls");
    expect(table).toContain("writePortfolioDeskXchatHandoff");
    expect(table).toMatch(/alert · chain · chat/);
  });

  it("exports reusable OptionChainTable from xoptions components", () => {
    const src = readFileSync(join(ROOT, "src/components/xoptions/option-chain-table.tsx"), "utf8");
    expect(src).toContain("export function OptionChainTable");
    expect(src).toContain("xoptions-chain-table--hnwi");
  });
});
