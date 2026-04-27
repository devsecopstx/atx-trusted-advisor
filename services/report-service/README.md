# Reusable Report Service (ReportLab)

Production-ready pattern for advisor-grade PDF exports in aTx Finance.

## Current generator

- `options_scan_report.py`
  - stdin JSON -> stdout PDF bytes
  - pure in-memory generation (no temp files)
  - branded tables, summary metrics, and disclaimer footer

## Contract

Input JSON:

```json
{
  "title": "Options Action Scan Report",
  "scanData": {
    "generatedAt": "2026-04-27T15:42:55.000Z",
    "planTier": "premium_plus",
    "truncated": false,
    "rows": [],
    "disclaimer": "Not financial advice..."
  }
}
```

Output: raw PDF bytes on stdout.

## Local usage

```bash
python3 services/report-service/options_scan_report.py --sample
cat payload.json | python3 services/report-service/options_scan_report.py --stdin > report.pdf
```

## Next.js integration

- Route: `POST /api/reports/options-scan`
- Implementation: `src/app/api/reports/options-scan/route.ts`
- UI trigger: `src/app/reports/scan/ui/options-action-scan-report.tsx`

The UI keeps a legacy `jsPDF` fallback if Python/ReportLab is unavailable.
