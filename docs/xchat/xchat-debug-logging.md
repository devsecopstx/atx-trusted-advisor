# xChat Debug Logging

When `ENABLE_XCHAT_DEBUG=true` is set in the GCP environment (Cloud Run), the app emits detailed structured logs for xChat ask and batch flows. Use these for RAG and xFinance expert learning.

## What is logged

- **Ask route** (`POST /api/xchat/ask`): Summary (`xchat_ask`) and full payload (`xchat_ask_full`) — system prompt, user prompt, RAG context, tools, model, response text.
- **Batch** (`POST /api/xchat/batch`): Per-item payload metadata and batch-level summary.

All logs use the prefix `[xchat/debug]` and JSON structure for easy filtering in Cloud Logging.

## Enabling

1. **GitHub variable** (recommended): Set `ENABLE_XCHAT_DEBUG=true` for the staging or production environment. The deploy workflow passes it to Cloud Run.
2. **Manual**: `gcloud run services update <service> --region <region> --set-env-vars ENABLE_XCHAT_DEBUG=true`

## Log retention (30 days)

Cloud Logging retention is configured at the **project** or **log bucket** level, not in application code.

To retain xChat debug logs for 30 days:

1. **Default _Default bucket**:**
   ```bash
   gcloud logging buckets update _Default --location=global --retention-days=30 --project=<project-id>
   ```
2. **Or create a dedicated bucket** for xChat debug with 30-day retention, then route `[xchat/debug]` logs to it via a log sink.

Filter in Cloud Logging: `textPayload=~"\[xchat/debug\]"` or `jsonPayload.type="xchat_ask"`.

## Privacy

User IDs and emails are masked in logs (e.g. `507f...011`, `ab***@example.com`). Full prompts and RAG context are logged when debug is enabled — use only in trusted staging or controlled production environments.
