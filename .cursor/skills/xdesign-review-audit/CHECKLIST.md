# xdesign-review-audit Checklist

Repo-specific ground truth: **`docs/ops/audit-lineage-and-controls.md`** (BFF parity, Mongo schema, test inventory, known gaps).

## Validation Checklist

- [ ] Any sampled **material AI decision** (xChat / recommendations) has a replay story: either stored artifacts + pinned deps, or explicit “not supported” with compensating controls
- [ ] **Tamper-evidence:** Mongo `admin_audit_events` is append-only app inserts; **no** hash chain today — flag if the engagement requires cryptographic integrity
- [ ] RAG lineage (chunk IDs, file versions) is captured where product promises it — **not** fully covered by generic audit rows alone
- [ ] Post-processing transforms are versioned and reproducible (persona publish, strategy normalizers, etc.)
- [ ] **Admin audit retrieval:** `GET /api/admin/audit` — confirm actor filter semantics (Next regex vs Kotlin exact match) when comparing environments
- [ ] **BFF on:** For each proxied mutation, JVM duplicates audit/Slack side effects per `api-consolidation-spring-backend.md` parity table
- [ ] Audit exports are complete and regulator-readable (if required, add export job + schema)
- [ ] Runtime config provenance is clear (GCP Secret Manager vs GH vars/secrets)
- [ ] Access-approval bootstrap failure path records `alert-user-not-sync-warning`
- [ ] Vitest covers critical paths: `tests/integration/admin-audit-route.test.ts`, `tests/integration/self-access-request-route.test.ts`, `tests/unit/audit-event-contract.test.ts`, smoke `backend-http-api-parity`
