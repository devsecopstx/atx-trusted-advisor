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
- MongoDB (Atlas or local) URI — do not commit real secrets

Build tool: **Gradle** (`build.gradle.kts`, `gradlew`). There is **no** `pom.xml`; the repo-root `Dockerfile` runs `gradle bootJar` against this module.

Environment: copy **`.env.example`** in this directory to **`.env`**, fill values, then export before `bootRun` (Spring does not load `.env` automatically), e.g. `set -a && source .env && set +a && ./gradlew bootRun`. For **Docker Compose**, the repo-root **`.env`** is loaded for the `atxfinance-backend` service — copy needed keys from this example there. Full key list and comments live in **`.env.example`**.

Run:
```
cd services/atxfinance-backend
cp .env.example .env
chmod +x ./gradlew   # once, if needed
set -a && source .env && set +a && ./gradlew bootRun
```

Tests:
```
./gradlew test
```

Health (`BackendHealthController` + Actuator):
- Actuator: `GET http://localhost:8080/actuator/health`
- Compatibility shim: `GET http://localhost:8080/api/health`
- Diagnostics: `GET http://localhost:8080/api/backend/health`

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
- Observability: Micrometer metrics (GMP scrape) + OTEL tracing (OTLP). Outbound **`RestTemplate`** calls use a custom **`ClientRequestObservationConvention`** so Prometheus **`http.client.requests`** `uri` tags stay low-cardinality (xAI collection/file ids templated); see **`ClientHttpMetricsConventionConfig`**. Yahoo chain traffic uses **`java.net.http.HttpClient`** and is not in that meter.
