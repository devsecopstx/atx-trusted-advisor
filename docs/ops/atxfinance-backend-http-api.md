# atxfinance-backend — HTTP API (Kotlin / Spring Boot)

**Base URL (local Compose):** `http://localhost:8080`  
**Scope:** Scheduler / worker service built from repo-root `Dockerfile` and `services/atxfinance-backend`. This is **not** the Next.js App Router API (`http://localhost:3000/api/*`).

Canonical route list is enforced by `tests/smoke/backend-http-api-parity.test.ts` (Vitest) against Kotlin sources + this document.

## Health & ops

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/actuator/health` | Spring Boot Actuator liveness/readiness (`management.*`). Response is standard actuator JSON (e.g. `{ "status": "UP" }` when authorized to see details per config). |
| GET | `/api/health` | **Compatibility shim:** lightweight check: Mongo connectivity via `MongoClient`, plus **presence-only** secrets flags (no secret values). `details.secrets` is `ok` if any of `MONGODB_URI`, `SPRING_DATA_MONGODB_URI`, or `MONGODB_URI_B64` is set in the process environment (matches Docker Compose and Atlas-style deploys). |
| GET | `/api/backend/health` | **SRE / diagnostics:** service name, UTC time, `activeProfiles`, masked Mongo URI (`uriMasked`), resolved host/database, mongo ping status, and env **flags** only (`MONGODB_URI_B64_present`, etc.). HTTP **200** even when nested `details.mongo.status` is `error` (inspect body). |

## OpenAPI / Swagger UI

SpringDoc OpenAPI 2.x (see `services/atxfinance-backend/build.gradle.kts`):

| Purpose | URL (local) |
|---------|-------------|
| Swagger UI | `http://localhost:8080/swagger-ui.html` (may redirect to `/swagger-ui/index.html`) |
| OpenAPI JSON | `http://localhost:8080/v3/api-docs` |

## Configuration (Mongo)

Resolution order for Spring Data Mongo URI (high level):

1. **`MONGODB_URI_B64`** — if set, `MongoUriEnvPostProcessor` decodes and injects `spring.data.mongodb.uri` at highest precedence (same pattern as the core Next.js app).
2. Else **`spring.data.mongodb.uri`** from `application.yml` / env: `MONGODB_URI` or `SPRING_DATA_MONGODB_URI` or default `mongodb://localhost:27017/${MONGODB_DB_NAME:atxfintechdb}`.

Docker Compose sets `SPRING_DATA_MONGODB_URI` explicitly for the `atxfinance-backend` service unless overridden by `.env` / `MONGODB_URI_B64`.

## Testing

- **JVM unit tests:** from `services/atxfinance-backend`: `./gradlew test`
- **Repo gate (Node):** `npm run ci:gate` includes `tests/smoke/backend-http-api-parity.test.ts` for doc ↔ Kotlin parity (no live server).

## Related

- Runbook-style notes: `docs/ops/junie-guidelines-atxfinance-backend.md`
- Local stack: `DEVELOPMENT.md` → *Local Setup (Backend → Frontend)*
