# Kubernetes samples (not applied by default)

These files are **examples** for operators wiring **GCP Secret Manager** into pods. They are **not** included in `kubectl apply -k deploy/k8s/base` because clusters must have the **Secret Store CSI driver** (and Workload Identity bindings) provisioned first.

| File | Purpose |
| ---- | ------- |
| [`secretproviderclass-gcp.sample.yaml`](./secretproviderclass-gcp.sample.yaml) | Illustrative `SecretProviderClass` for mounting GSM secrets as files/env |

After adapting **`PROJECT_ID`** and secret names, apply manually and patch Deployments to use **`csi.volume`** mounts per [GKE CSI docs](https://cloud.google.com/kubernetes-engine/docs/how-to/secrets-store-csi-driver).
