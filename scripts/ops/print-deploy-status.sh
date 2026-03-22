#!/usr/bin/env bash
set -euo pipefail
# Print stage/prod URLs and latest staging + production deploy runs. Requires gh CLI and repo context.
printf "stage_url=%s\n" "$(gh variable get STAGING_BASE_URL)"
printf "prod_url=%s\n" "$(gh variable get PROD_BASE_URL)"
echo "latest_staging_deploy:"
gh run list --workflow "Deploy Cloud Run" --limit 1
echo "latest_production_deploy:"
gh run list --workflow "Deploy Cloud Run Production" --limit 1
