/**
 * User-facing copy for `/import-activity` (single source for UI + tests).
 */
export const importActivityPageCopy = {
  title: "Import broker holdings & activities",
  introLead:
    "Upload CSV exports from your broker to refresh your portfolio positions and activity history.",
  introBackground:
    "The import runs safely in the background and keeps your risk data, xOptions scanners, and monitoring accurate.",
  brokerRoadmapNote:
    "CSV import today: Merrill Edge and Fidelity. Coming soon: Interactive Brokers (IBKR), E*TRADE, Forge Global (private markets), and Hiive (pre-IPO marketplace)."
} as const;

export const importActivityWorkflowCopy = {
  stepPortfolioLabel: "Portfolio",
  stepFileLabel: "Import file",
  stepReviewLabel: "Review & import",
  stepNext: "Continue",
  stepBack: "Back",
  stepRunPreview: "Continue to review",
  stepRunImport: "Run import",
  supportedFilesHeading: "Supported Files",
  supportedFiles: [
    "Portfolio holdings (multi-account positions export)",
    "Account History (activity ledger)",
    "Legacy single-account Positions CSV"
  ],
  howToHeading: "How to Import",
  howToSteps: [
    "Step 1 — Choose the portfolio and which accounts can receive this import.",
    "Step 2 — Pick broker and upload or paste the CSV export.",
    "Step 3 — Review parsed positions, confirm mappings, then run import."
  ],
  optionsHeading: "Options note",
  optionsBody:
    "Option quantity sign is preserved: positive contracts = long, negative = short (e.g. covered calls, CSPs). Scanners use this sign for close/hold logic.",
  deleteHoldingsFirstLabel: "Delete existing holdings before import",
  deleteHoldingsFirstHint:
    "When checked (default), all current positions in this portfolio are removed and prior broker-import jobs cleared immediately before your CSV is applied — a clean replace. Accounts and watchlists stay. Uncheck only if you intend to merge into positions already in the book.",
  importCompleteOpenPortfolio: "Open portfolio",
  importCompleteViewWorkspace: "View in portfolios workspace"
} as const;
