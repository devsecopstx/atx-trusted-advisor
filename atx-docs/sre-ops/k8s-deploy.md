# Kubernetes deploy runbook (GKE scale-out path)

Canonical **stub manifests** live under [`deploy/k8s/`](../../deploy/k8s/). **Production today** ships on **Cloud Run** (see [`deploy-and-ops.md`](../guides/deploy-and-ops.md), [`gcp-prod-two-service-model.md`](./gcp-prod-two-service-model.md)). Treat this document as the **migration playbook** when Cloud Run concurrency, cold-start budgets, or cost curves favor a **dedicated GKE Autopilot** (or Standard) cluster.

## When to migrate (rule of thumb)

- **Trigger:** sustained interactive load **beyond ~50 concurrent users** (or equivalent steady RPS/latency budget) where Cloud Run max instances, CPU allocation, or upstream limits become the bottleneck — validate with **Cloud Monitoring** (Cloud Run revision metrics, `request_latencies`, `instance_count`) rather than user count alone.
- **Goal topology:** **two Deployments** — **Next.js frontend** (`atxfinance-frontend`) and **Spring backend** (`atxfinance-backend`) — both behind cluster networking; **public Ingress** terminates TLS at the **frontend** only; backend stays **ClusterIP**.
- **Scale policy:** **HorizontalPodAutoscaler** on **average CPU utilization 60%** for both workloads (see `deploy/k8s/base/*/hpa.yaml`). Tune `minReplicas` / `maxReplicas` after load tests.

## Architecture (stub alignment)

| Layer | Resource | Notes |
| ----- | -------- | ----- |
| Namespace | `atxfinance-prod` | [`deploy/k8s/base/namespace.yaml`](../../deploy/k8s/base/namespace.yaml) |
| Frontend | `Deployment` + `Service` + `ServiceAccount` | Port **3000** → Service **80** |
| Backend | `Deployment` + `Service` + `ServiceAccount` | ClusterIP **8080**, Actuator health `/actuator/health` |
| Edge | `Ingress` (`ingressClassName: gce`) | Host + managed cert placeholders in manifest comments |
| Autoscale | `HorizontalPodAutoscaler` ×2 | CPU target **60%**, scale-down stabilization **300s** |
| Resilience | `PodDisruptionBudget` ×2 | `minAvailable: 1` — tighten/evolve when replicas grow |
| Ingress tuning | `BackendConfig` | HTTP health check **`/api/health`** for GCP load balancer |
| Config | `ConfigMap` | In-cluster **`ATXFINANCE_BACKEND_ORIGIN`** default (override per env) |
| Metrics | `PodMonitoring` (backend) | Scrapes **`/actuator/prometheus`** — requires **GKE Managed Service for Prometheus** |

**BFF origin:** Frontend pods should call the JVM via cluster DNS, e.g. `http://atxfinance-backend.atxfinance-prod.svc.cluster.local:8080`, surfaced as **`ATXFINANCE_BACKEND_ORIGIN`** (matches Cloud Run mental model). OAuth callbacks and browser-visible URLs still use the **public Ingress host**, not the cluster Service URL.

## Prerequisites

1. **GKE cluster** — **Autopilot** is acceptable; enable **Workload Identity** if pods read Secret Manager or GCP APIs without static keys.
2. **Artifact Registry** — same repo pattern as Cloud Run (`atxfinance-core-app` per [`.cursor/rules/sre-gcp-deployment.md`](../../.cursor/rules/sre-gcp-deployment.md)); build and push **`atxfinance-frontend`** / **`atxfinance-backend`** images with immutable tags (`IMAGE_TAG` = Git SHA or semver).
3. **metrics-server** — included on Autopilot; required for **CPU-based HPA**.
4. **Managed Service for Prometheus** — enable if applying **`PodMonitoring`** (`deploy/k8s/monitoring/podmonitoring-backend.yaml`). See [`deploy/k8s/monitoring/README.md`](../../deploy/k8s/monitoring/README.md).
5. **Secrets** — **do not** commit credentials. Prefer [Secret Manager CSI driver](https://cloud.google.com/kubernetes-engine/docs/how-to/secrets-store-csi-driver) or **External Secrets**; a **sample** `SecretProviderClass` lives under [`deploy/k8s/samples/`](../../deploy/k8s/samples/) (not part of `kubectl apply -k deploy/k8s/base`).

## Apply order

```bash
# From repo root — after replacing PROJECT_ID / REGION / IMAGE_TAG in manifests or via overlays
kubectl apply -k deploy/k8s/base
kubectl apply -f deploy/k8s/monitoring/podmonitoring-backend.yaml
```

Detailed placeholder table and file map: [`deploy/k8s/README.md`](../../deploy/k8s/README.md).

## Observability and ops monitoring

- **Metrics:** Backend Prometheus scrape via **PodMonitoring**; frontend relies on **GKE workload metrics**, **HTTP(S) LB** metrics, and **structured logs** until a Prometheus `/metrics` endpoint exists on Next (optional future).
- **Logs:** Route container logs to **Cloud Logging**; use **log-based metrics** for **5xx rate**, **latency proxies**, and **`[xchat/ask]`** / **`[auth/x/callback]`** error fingerprints already documented in repo runbooks.
- **Alerts:** Create **Cloud Monitoring alert policies** on LB **backend unhealthy**, **HPA max replicas sustained**, **pod restart rate**, and **error budget** burn — concrete metric names depend on project dashboards; start from GKE **Infrastructure** and **HTTP/S LB** curated dashboards.
- **Tracing:** Optional **Cloud Trace** export from Next/JVM — align with existing Cloud Run posture when parity matters.

Full stub-level checklist: [`deploy/k8s/monitoring/README.md`](../../deploy/k8s/monitoring/README.md).

## CI/CD (future)

Today **no** GitHub workflow applies these manifests. A production-grade path mirrors [.cursor/rules/sre-gcp-deployment.md](../../.cursor/rules/sre-gcp-deployment.md): **Cloud Build** → **Artifact Registry** → **`gke-deploy`** or **Config Sync / GitOps**, plus **progressive delivery** (canary/blue-green) and **automated rollback** on health/regression checks.

## Cutover checklist (high level)

1. **Parity:** Same Secret Manager **secret IDs** as Cloud Run (`gcp-runtime-secrets.inc.sh`) mounted via CSI or synced objects.
2. **DNS:** Point **Ingress** host at **GKE load balancer** IP / serverless NEG — mirror **`STAGING_BASE_URL`** / **`PROD_BASE_URL`** and OAuth callback docs ([`x-oauth-atx-callbacks.md`](./x-oauth-atx-callbacks.md)).
3. **Data plane:** **MongoDB Atlas / Memorystore** endpoints reachable from **VPC** (Private Service Connect or authorized networks — match Atlas firewall model).
4. **Validate:** `curl https://<host>/api/health` → **`status":"ok"`**, **`version`** matches `package.json`; backend **`/actuator/health`** green inside cluster (`kubectl port-forward` or debug pod).
5. **Load:** Soak test until **HPA** scales past **60%** CPU target without breaching p95 latency SLO; adjust **requests/limits** and **`maxReplicas`**.
6. **Decommission:** Drain Cloud Run traffic only after **48h** stable error rates (project policy).

## Related docs

- [`deploy/k8s/README.md`](../../deploy/k8s/README.md) — manifest index and placeholders  
- [`deploy-and-ops.md`](../guides/deploy-and-ops.md) — current Cloud Run promotion model  
- [`gcp-prod-two-service-model.md`](./gcp-prod-two-service-model.md) — two-service mental model (maps to two Deployments on GKE)
