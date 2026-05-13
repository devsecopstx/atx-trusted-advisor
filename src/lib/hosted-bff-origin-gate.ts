import { getAtxfinanceBackendOrigin } from "@/lib/env";

/**
 * Hosted Cloud Run images set **`NODE_ENV=production`** and **`ATX_DEPLOY_TARGET`** to **`stage`** (staging)
 * or **`deploy`** (production) — see `scripts/ops/deploy-cloud-run-from-env.sh` and `.github/workflows/deploy-cloud-run*.yml`.
 *
 * For those processes, **`ATXFINANCE_BACKEND_ORIGIN`** must point at the Spring service so the BFF can
 * reach JVM-backed mutations (and read paths that already proxy). Without it, the app would silently run
 * Next-only Mongo fallbacks in prod-shaped traffic.
 *
 * **Bypass (break-glass only):** set **`ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN=1`** on the Cloud Run revision.
 */
export function assertHostedCloudRunRequiresAtxfinanceBackendOrigin(): void {
  if (process.env.ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN?.trim() === "1") {
    console.warn(
      "[startup/bff] ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN=1 — skipping ATXFINANCE_BACKEND_ORIGIN requirement (break-glass only)"
    );
    return;
  }
  const nodeEnv = (process.env.NODE_ENV ?? "development").trim();
  const deployTarget = (process.env.ATX_DEPLOY_TARGET ?? "").trim().toLowerCase();
  if (nodeEnv !== "production") {
    return;
  }
  if (deployTarget !== "stage" && deployTarget !== "deploy") {
    return;
  }
  const origin = getAtxfinanceBackendOrigin();
  if (origin) {
    return;
  }
  throw new Error(
    "ATXFINANCE_BACKEND_ORIGIN is required for hosted Cloud Run (NODE_ENV=production and ATX_DEPLOY_TARGET is stage or deploy). " +
      "Set it to the Spring HTTPS origin (same value as GitHub vars / .env.prod). " +
      "Deploy scripts and workflows already enforce this at release time; this check blocks misconfigured revisions. " +
      "Emergency bypass: ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN=1."
  );
}
