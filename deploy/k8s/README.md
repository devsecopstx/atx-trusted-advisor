# Kubernetes stubs (GKE scale-out path)

These manifests are **not** wired into CI today. **Canonical runbook:** [`atx-docs/sre-ops/k8s-deploy.md`](../../atx-docs/sre-ops/k8s-deploy.md).

Use them when migrating off Cloud Run — rule of thumb **~50+ concurrent users** or sustained RPS/latency pressure where Cloud Run limits dominate (validate with Cloud Monitoring, not user counts alone). Topology: **one frontend Deployment** (Next.js), **one backend Deployment** (Spring), **HPA CPU target 60%** each, **ops monitoring** via GMP **PodMonitoring** (backend) + LB / workload metrics + logs (see [`monitoring/README.md`](./monitoring/README.md)).

Replace placeholders before apply:

| Placeholder | Example |
| --- | --- |
| `PROJECT_ID` | GCP project hosting GKE + Artifact Registry |
| `REGION` | `us-central1` (match `.cursor/rules/sre-gcp-deployment.md` defaults) |
| `IMAGE_TAG` | Git SHA or semver |

**Images:** Build/push with the same Artifact Registry repo as Cloud Run (`atxfinance-core-app` per SRE docs). Image names here are illustrative — align with your `Dockerfile` / `Dockerfile.backend` publish tags.

**Secrets:** Do not commit credentials. Prefer [Secret Manager CSI driver](https://cloud.google.com/kubernetes-engine/docs/how-to/secrets-store-csi-driver) or External Secrets; wire `env` / `envFrom` in the Deployments after you choose a pattern.

**Monitoring:** Backend **PodMonitoring** scrapes Spring Actuator (`/actuator/prometheus`). Frontend: **Cloud Monitoring** (GKE workload metrics, HTTP LB metrics, log-based metrics); details and alert seeds — [`monitoring/README.md`](./monitoring/README.md).

**Secrets CSI:** Sample **`SecretProviderClass`** only — [`samples/`](./samples/) (not included in `kubectl apply -k`).

**Resilience:** **PodDisruptionBudget** per Deployment (`pdb-*.yaml`). **Ingress** health checks via **`BackendConfig`** on the frontend Service.

**Prerequisites:** GKE cluster (Autopilot is fine), `metrics-server` (Autopilot includes it), optional [Managed Service for Prometheus](https://cloud.google.com/stackdriver/docs/managed-prometheus) for PodMonitoring CRDs.

Apply order: namespace → secrets/config (your process) → deployments → services → HPA → ingress → monitoring.

```bash
kubectl apply -k deploy/k8s/base
kubectl apply -f deploy/k8s/monitoring/podmonitoring-backend.yaml
```
