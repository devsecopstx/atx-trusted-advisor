"use client";

export type PortfolioAccountCsvRow = {
  account: string;
  broker: string;
  accountRef: string;
  positions: number;
  costBasisUsd: number;
  marketValue: string;
  dayChange: string;
  pl: string;
  risk: string;
  strategy: string;
};

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

type PortfolioAccountsExportButtonProps = {
  rows: PortfolioAccountCsvRow[];
  filename?: string;
};

export function PortfolioAccountsExportButton({
  rows,
  filename = "portfolio-accounts.csv"
}: PortfolioAccountsExportButtonProps) {
  function download() {
    const headers: (keyof PortfolioAccountCsvRow)[] = [
      "account",
      "broker",
      "accountRef",
      "positions",
      "costBasisUsd",
      "marketValue",
      "dayChange",
      "pl",
      "risk",
      "strategy"
    ];
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="portfolio-export-csv" onClick={download} disabled={rows.length === 0}>
      <span aria-hidden className="portfolio-export-csv__icon">
        ↓
      </span>
      Export CSV
    </button>
  );
}
