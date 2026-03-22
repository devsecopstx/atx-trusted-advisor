# atxfinance-backend CI Harness (Reference)

This folder contains a minimal, non-destructive harness to validate the reliability properties for the atxfinance=backend service.

Prereqs:
- Node 18+
- If testing locally, use the Pub/Sub emulator; otherwise target staging with least-privileged credentials.

Files:
- publish.js — publishes test messages, including duplicate and poison messages
- dlq-size.js — prints the DLQ message count

Usage examples:
```
node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --count 5 --same-key same-key-123
node scripts/backend-ci/publish.js --topic atxfinance-backend-requests --poison true --key poison-1
node scripts/backend-ci/dlq-size.js --dlq-topic atxfinance-backend-requests-dlq
```

Note: These scripts are samples and require proper GCP auth and environment configuration to run against staging.
