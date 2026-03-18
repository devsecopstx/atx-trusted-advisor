#!/usr/bin/env bash
# Set gcloud defaults for atxfinance Cloud Run deploys.
# Run once: bash scripts/ops/gcloud-default-config.sh

set -euo pipefail

gcloud config set run/region us-central1
echo "Set run/region=us-central1"

# Optional: set default project
# gcloud config set project fintech-advisor-staging
