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
    "Make sure account numbers in your CSV exactly match the Broker ref shown below.",
    'Check "Use for import" for the accounts you want to update.',
    "Upload → review the safe preview → select rows → import (only selected rows are saved)."
  ],
  optionsHeading: "Options note",
  optionsBody:
    "Only net-long option legs are imported right now. Net-short legs are skipped until short modeling is enabled.",
  cleanTitle: "Clean first, then import",
  cleanBody:
    "Use this for a completely fresh start. It clears all existing positions and prior import records in the selected portfolio (your accounts stay intact)."
} as const;
