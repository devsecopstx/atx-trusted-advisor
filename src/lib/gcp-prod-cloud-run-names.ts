/**
 * Canonical GCP Cloud Run identifiers for atxFinance deploy runbooks.
 * Source of truth for prod Next frontend name (same string as prod GCP project id).
 */
export const GCP_PROD_PROJECT_ID = "fintech-advisor-prod" as const;

/** Production Next.js frontend Cloud Run service. */
export const GCP_PROD_NEXT_SERVICE_NAME = "fintech-advisor-prod" as const;

/** Production Spring backend Cloud Run service. */
export const GCP_PROD_SPRING_SERVICE_NAME = "atxfinance-backend-prod" as const;

export const GCP_STAGING_PROJECT_ID = "fintech-advisor-staging" as const;

/** Staging Next.js frontend Cloud Run service. */
export const GCP_STAGING_NEXT_SERVICE_NAME = "xfinance-core-staging" as const;

/** Staging Spring backend Cloud Run service. */
export const GCP_STAGING_SPRING_SERVICE_NAME = "atxfinance-backend-staging" as const;

export const GCP_CLOUD_RUN_REGION_DEFAULT = "us-central1" as const;
