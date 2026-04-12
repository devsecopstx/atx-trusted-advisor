# Admin delivery channels and notify (Next)

Scope:
- Repository: `src/modules/core-admin/repository.ts` — admin delivery channels CRUD and lookups.
- Routes: `src/app/api/admin/delivery-channels/**` — GET/POST and per-id PATCH/DELETE.
- Notifier: `src/modules/core-admin/scheduled-task-slack-notify.ts` — Slack and Desk SMTP summaries for task runs.
- Types: `src/modules/core-admin/types.ts` (AdminDeliveryChannel).

Key points:
- Channels are system-wide; tenant options are currently passed to keep call shapes consistent but ignored server-side.
- Slack: requires a valid `https://hooks.slack.com/services/...` URL.
- Email: `emailTo` must be a valid email; Desk SMTP must be configured.
- System-wide tasks (no `tenantId`) resolve channel with `getAdminDeliveryChannelByIdUnscoped`.

Tests:
- `tests/integration/admin-delivery-channels-routes.test.ts` validates repository calls, payload validation, and audit events.
- `tests/unit/scheduled-task-slack-notify.test.ts` covers Slack and email summarization.

Troubleshooting:
- If type errors reference extra props (e.g., `tenantId`), ensure repository signatures accept optional options and are referenced (`void _options;`).
