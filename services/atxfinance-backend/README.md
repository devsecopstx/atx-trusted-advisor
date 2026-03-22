# atxfinance-backend (Kotlin/Spring Boot)

Fault-tolerant, multi-node aware scheduler service designed to manage thousands of scheduled tasks.

Defaults approved:
- Orchestrator: Cloud Run
- Scheduler: ShedLock + MongoDB
- Queue: Google Pub/Sub (with DLQ)
- Instance resources: 1 vCPU, 1 GiB RAM
- Observability: Google Managed Prometheus (Micrometer) + OpenTelemetry (OTLP)

## Quickstart (local dev)

Prereqs:
- JDK 21 (Temurin recommended)
- MongoDB (Atlas or local) URI — do not commit real secrets; use `.env` or local export

Build tool: **Gradle** (`build.gradle.kts`, `gradlew`). There is **no** `pom.xml`; the repo-root `Dockerfile` runs `gradle bootJar` against this module.

Environment vars (example) — use empty placeholders in `.env.example` at repo root when we wire secrets:
- `MONGODB_URI` — for Spring Data + ShedLock (Mongo lock collection)
- `PUBSUB_PROJECT_ID` — GCP project to target (staging)
- `PUBSUB_TOPIC` — e.g. `atxfinance-backend-requests`
- `PUBSUB_DLQ_TOPIC` — e.g. `atxfinance-backend-requests-dlq`
- `OTEL_EXPORTER_OTLP_ENDPOINT` — OTLP collector endpoint (optional for local)

Run:
```
cd services/atxfinance-backend
chmod +x ./gradlew   # once, if needed
./gradlew bootRun
```

Tests:
```
./gradlew test
```

Health:
- Actuator: `GET http://localhost:8080/actuator/health`
- Compatibility shim: `GET http://localhost:8080/api/health`

Swagger UI:
- `GET http://localhost:8080/swagger-ui.html`

## Cloud Run baseline (to be wired in deploy skills)
- Concurrency: 1
- CPU: 1 vCPU
- Memory: 1 GiB
- Min/Max instances per env (TBD): start with `min=0, max=5` (staging)

## Notes
- This service uses ShedLock + Mongo to coordinate schedules across nodes. Each scheduled method acquires a distributed lock in Mongo before running.
- For long-running work, producers publish to Pub/Sub. A consumer (pull subscriber) handles retries and DLQ routing. Initial implementation provides stubs and health indicators.
- Observability: Micrometer metrics (GMP scrape) + OTEL tracing (OTLP).
