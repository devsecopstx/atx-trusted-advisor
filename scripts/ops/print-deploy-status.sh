#!/usr/bin/env bash
set -euo pipefail
# Print stage/prod URLs and latest Deploy Cloud Run run. Requires gh CLI and repo context.
printf "stage_url=%s\n" "$(gh variable get STAGING_BASE_URL)"
printf "prod_url=%s\n" "$(gh variable get PROD_BASE_URL)"
echo "latest_deploy:"
gh run list --workflow "Deploy Cloud Run" --limit 1
