# Mongo write boundary (Next.js vs Spring)

## Immediate rule (sprint policy)

- **No new direct writes from Next to Mongo.** All **POST / PUT / PATCH / DELETE** product paths should hit **Spring** via the BFF (`ATXFINANCE_BACKEND_ORIGIN` + `proxy*RequestToBackend` / entries in `src/lib/bff-proxy-routes.ts`), or call a **repository** in `src/modules/**` that is explicitly scheduled for JVM migration.
- **Reads** may remain on Next + Mongo for high-churn GETs until a **Spring read plane** or materialized view backs them — see **[`spring-read-plane-and-mongo-exit.md`](./spring-read-plane-and-mongo-exit.md)**.

## ESLint

- Plugin: `eslint-rules/atx-mongo-data-plane.mjs`, wired in `eslint.config.mjs`.
  - **`atx-mongo/no-mongo-client-import-outside-lib`** — `MongoClient` import from `mongodb` only in `src/lib/mongodb.ts` (plus `tests/`, `scripts/`, `services/`).
  - **`atx-mongo/no-mongo-collection-writes-outside-data-plane`** — blocks `.updateOne`, `.insertOne`, `.deleteOne`, `.findOneAndUpdate`, etc. **anywhere under `src/`** except **`src/modules/**`**, **`src/lib/mongodb.ts`**, and the **legacy API allowlist** in that file (`admin/tenants/*`, `admin/platform/route-catalog/*`, `admin/tenants/*/roles/*` until Spring exposes replacements). Replaces the narrower route-only rule so `src/app`, `src/components`, and `src/lib` cannot sneak in new driver writes.
  - **`atx-mongo/no-suspicious-save-outside-data-plane`** — blocks ambiguous `.save()` outside the data plane unless the receiver is **`ctx`** (canvas) or the file is in **`NON_MONGOOSE_SAVE_FILE_ALLOWLIST`** (jsPDF and similar).

## BFF registry

- Canonical list: **`src/lib/bff-proxy-routes.ts`** (must match Kotlin `@*Mapping` needles; see `tests/smoke/backend-http-api-parity.test.ts`).
- Kotlin HTTP inventory: **`atx-docs/sre-ops/atxfinance-backend-http-api.md`**.

## Short-term (4–6 weeks)

Move **writes** for **`portfolio_positions`**, **watchlist**, **`admin_scheduled_tasks`** (tenant tasks remain Next-orchestrated today — see `backend-bff.ts` `shouldProxyAdminScheduledTasksToBackend`), **`xchat_user_preferences`**, and **`strategy_jobs`** to Spring; keep Next **GET** hot paths on Mongo until explicitly migrated.

## Related

- **[`data-ownership-mongo-internal-memo.md`](./data-ownership-mongo-internal-memo.md)** — one-page team memo: Spring owns in-scope Mongo writes when BFF is on; intentional Next-owned paths.
- **[`architecture/adr-002-read-facade-and-next-mongo-reads.md`](../architecture/adr-002-read-facade-and-next-mongo-reads.md)** — read facade + inventory of remaining Next Mongo reads and target quarters.
