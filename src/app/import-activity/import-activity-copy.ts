/**
 * User-facing copy for `/import-activity` (single source for UI + tests).
 */
export const importActivityPageCopy = {
  title: "Import broker holdings & activities",
  introLead:
    "Upload CSV exports from your broker to refresh your portfolio positions and activity history.",
  introBackground:
    "The import runs safely in the background and keeps your risk data, xOptions scanners, and monitoring accurate."
} as const;

export const importActivityWorkflowCopy = {
  supportedFilesHeading: "Supported Files",
  supportedFiles: [
    "Portfolio holdings (multi-account positions export)",
    "Account History (activity ledger)",
    "Legacy single-account Positions CSV"
  ],
  howToHeading: "How to Import",
  howToSteps: [
    "Choose portfolio, broker, and CSV (or paste). Account numbers in the file must match Broker ref below.",
    'Turn on "Use for import" for each account this file should update.',
    "Preview, pick rows, then Run import. Leave delete holdings checked for a full replace (default)."
  ],
  optionsHeading: "Options note",
  optionsBody:
    "Option quantity sign is preserved: positive contracts = long, negative = short (e.g. covered calls, CSPs). Scanners use this sign for close/hold logic.",
  deleteHoldingsFirstLabel: "Delete existing holdings before import",
  deleteHoldingsFirstHint:
    "When checked (default), all current positions in this portfolio are removed and prior broker-import jobs cleared immediately before your CSV is applied — a clean replace. Accounts and watchlists stay. Uncheck only if you intend to merge into positions already in the book."
} as const;
