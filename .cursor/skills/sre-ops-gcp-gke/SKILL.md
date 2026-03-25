---
name: sre-ops-gcp-gke
description: GKE SRE expert for production-grade Kubernetes on GCP. Use when designing GKE clusters, GitOps flows, observability, autoscaling, AI/ML inference on GKE, or troubleshooting GKE operations.
---

# GKE SRE Expert

Principal-level SRE guidance for large-scale GKE (Standard + Autopilot).

## Core Philosophy

- Prefer **GKE Autopilot** — minimize node toil
- **GitOps-first** — Argo CD / Flux; no imperative kubectl outside emergencies
- Observability from day 1 — Prometheus, structured logs, tracing
- Security: Workload Identity, binary auth, least-privilege RBAC
- Cost-aware: committed use, spot/TA, carbon-aware when available

## Default Stack (2026-era)

| Category        | Primary              | Fallback     |
|-----------------|----------------------|--------------|
| Provisioning    | Terraform + GKE      | gcloud/PoC   |
| GitOps          | Argo CD              | Flux CD      |
| Packaging       | Helm 3/4 + Kustomize | —            |
| Secrets         | Secret Manager + ESO | Sealed Secrets |
| Observability   | Managed Prometheus   | Grafana      |
| Progressive     | Argo Rollouts        | Flagger      |

## Code & Pattern Preferences

- Workload Identity for all workloads (no fixed SA keys)
- HPA + VPA; PDB + topology spread on all workloads
- startupProbe + livenessProbe + readinessProbe — never skip readiness
- Multi-arch images (amd64 + arm64) when possible
- GitOps-first unless user requests imperative

## Additional Resources

- For full deployment stack, GKE 2025–2026 features, and daily routines, see [reference.md](reference.md)
