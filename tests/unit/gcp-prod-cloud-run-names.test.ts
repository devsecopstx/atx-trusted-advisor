import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GCP_CLOUD_RUN_REGION_DEFAULT,
  GCP_PROD_NEXT_SERVICE_NAME,
  GCP_PROD_PROJECT_ID,
  GCP_PROD_SPRING_SERVICE_NAME,
  GCP_STAGING_NEXT_SERVICE_NAME,
  GCP_STAGING_PROJECT_ID,
  GCP_STAGING_SPRING_SERVICE_NAME
} from "@/lib/gcp-prod-cloud-run-names";

const SET_BACKEND_ORIGIN_SH = resolve(
  __dirname,
  "../../scripts/ops/set-atxfinance-backend-origin.sh"
);
const DEPLOY_CLOUD_RUN_SH = resolve(__dirname, "../../scripts/ops/deploy-cloud-run-from-env.sh");
const XAI_SECRET_BINDING_INC = resolve(
  __dirname,
  "../../scripts/ops/cloud-run-xai-secret-binding.inc.sh"
);
const DEPLOY_BACKEND_PROD_SH = resolve(
  __dirname,
  "../../scripts/ops/deploy-atxfinance-backend-production.sh"
);

describe("gcp-prod-cloud-run-names", () => {
  it("uses fintech-advisor-prod for prod GCP project and Next frontend service", () => {
    expect(GCP_PROD_PROJECT_ID).toBe("fintech-advisor-prod");
    expect(GCP_PROD_NEXT_SERVICE_NAME).toBe("fintech-advisor-prod");
    expect(GCP_PROD_NEXT_SERVICE_NAME).toBe(GCP_PROD_PROJECT_ID);
  });

  it("keeps Spring prod/staging service names separate from Next", () => {
    expect(GCP_PROD_SPRING_SERVICE_NAME).toBe("atxfinance-backend-prod");
    expect(GCP_STAGING_NEXT_SERVICE_NAME).toBe("xfinance-core-staging");
    expect(GCP_STAGING_SPRING_SERVICE_NAME).toBe("atxfinance-backend-staging");
    expect(GCP_STAGING_PROJECT_ID).toBe("fintech-advisor-staging");
    expect(GCP_CLOUD_RUN_REGION_DEFAULT).toBe("us-central1");
  });
});

describe("prod Next deploy script defaults", () => {
  const setBackendOrigin = readFileSync(SET_BACKEND_ORIGIN_SH, "utf8");
  const deployCloudRun = readFileSync(DEPLOY_CLOUD_RUN_SH, "utf8");

  it("defaults CLOUD_RUN_SERVICE_PROD to fintech-advisor-prod in set-atxfinance-backend-origin.sh", () => {
    expect(setBackendOrigin).toContain('CLOUD_RUN_SERVICE_PROD:-fintech-advisor-prod');
    expect(setBackendOrigin).not.toContain("xfinance-core-prod");
  });

  it("documents fintech-advisor-prod as the prod Next service name in deploy-cloud-run-from-env.sh", () => {
    expect(deployCloudRun).toContain("fintech-advisor-prod");
    expect(deployCloudRun).not.toContain("xfinance-core-prod");
  });
});

describe("cloud-run XAI_API_KEY GSM pin", () => {
  const xaiBindingInc = readFileSync(XAI_SECRET_BINDING_INC, "utf8");
  const deployCloudRun = readFileSync(DEPLOY_CLOUD_RUN_SH, "utf8");
  const deployBackendProd = readFileSync(DEPLOY_BACKEND_PROD_SH, "utf8");

  it("defines resolve + prepend helpers for explicit GSM version binding", () => {
    expect(xaiBindingInc).toContain("resolve_gcp_secret_enabled_version");
    expect(xaiBindingInc).toContain("cloud_run_secrets_prepend_xai_api_key");
  });

  it("deploy scripts source the helper and avoid XAI_API_KEY:latest", () => {
    expect(deployCloudRun).toContain("cloud-run-xai-secret-binding.inc.sh");
    expect(deployCloudRun).toContain("cloud_run_secrets_prepend_xai_api_key");
    expect(deployCloudRun).not.toMatch(/XAI_API_KEY=XAI_API_KEY:latest/);
    expect(deployBackendProd).toContain("cloud_run_secrets_prepend_xai_api_key");
    expect(deployBackendProd).not.toMatch(/XAI_API_KEY=XAI_API_KEY:latest/);
  });
});
