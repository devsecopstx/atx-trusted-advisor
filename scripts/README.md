# Scripts

This directory contains maintenance, migration, seeding, and operational scripts for the aTx Finance platform.

## xChat Performance Maintenance (New)

These scripts were added to improve query performance on `xchat_logs` and reduce expensive aggregates for the token usage sidebar.

### Available Commands

```bash
# Create all recommended indexes (idempotent)
npm run xchat:create-indexes

# Backfill the aggregated usage stats collection from historical logs
npm run xchat:backfill-usage-stats

# Run both index creation + backfill in the recommended order
npm run xchat:migrate-performance
```

### Dry Run Support

All three scripts support `--dry-run`:

```bash
npm run xchat:create-indexes -- --dry-run
npm run xchat:backfill-usage-stats -- --dry-run
npm run xchat:migrate-performance -- --dry-run
```

### What They Do

- **create-xchat-indexes.ts**: Creates optimized indexes on `xchat_logs` and `xchat_personas` (including new indexes for persona filtering and tenant-level analytics).
- **backfill-xchat-usage-stats.ts**: Populates the `xchat_user_usage_stats` collection with pre-aggregated token counts so that the sidebar and rate limit checks no longer need to scan millions of log rows.
- **migrate-xchat-performance.ts**: Convenience wrapper that runs the above two steps.

### Recommended Usage

1. Run `npm run xchat:migrate-performance` once after deploying the corresponding code changes.
2. The new aggregated stats collection will make `GET /api/app-user/xchat/token-stats` significantly faster.

---

## Other Script Categories

- `dev/` – Local development helpers
- `ops/` – Production / staging operations (deploy, secrets, etc.)
- `perf/` – Performance and diagnostics tools
- `lhci/` – Lighthouse CI helpers

See individual subfolder READMEs for more details.