# GKE monitoring stubs (ops)

## Managed Service for Prometheus (GMP)

**Backend:** [`podmonitoring-backend.yaml`](./podmonitoring-backend.yaml) selects **`app.kubernetes.io/name: atxfinance-backend`** and scrapes **`/actuator/prometheus`** on the **`http`** port every **30s**.

**Enable:** [Install Managed Service for Prometheus](https://cloud.google.com/stackdriver/docs/managed/prometheus/setup-managed#gke-ui) on the GKE cluster before applying `PodMonitoring` CRs.

**Frontend:** Next.js does not expose a Prometheus registry in-repo today. Use **Cloud Monitoring**:

- **Kubernetes Engine → Workloads** — CPU, memory, restart counts per Deployment.
- **HTTP(S) Load Balancing** — request volume, backend latency, unhealthy backends (paired with [`../base/frontend/backendconfig.yaml`](../base/frontend/backendconfig.yaml)).
- **Logs Explorer** — filters on `resource.type="k8s_container"` and `labels.k8s-pod/app`.

## Suggested alert policies (GCP Console)

Create alerting policies in **Cloud Monitoring** (names illustrative):

| Alert | Signal (starting point) |
| ----- | ----------------------- |
| Frontend unhealthy | LB backend service — **healthy backend count** < desired |
| Backend Prometheus missing | **kube_pod_status_ready** / custom scrape failures — tune after GMP export visible |
| HPA capped | `kubectl` visibility or **custom metric** — sustained **`kube_horizontalpodautoscaler_status_current_replicas`** == **`spec_max_replicas`** |
| Pod crash loop | **restart count** / **OOM** container logs |

Tune thresholds using **baseline week** on staging Autopilot before prod migration.

## Apply

```bash
kubectl apply -f deploy/k8s/monitoring/podmonitoring-backend.yaml
```

See **`atx-docs/sre-ops/k8s-deploy.md`** for the full migration runbook.
