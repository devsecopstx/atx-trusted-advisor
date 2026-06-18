#!/usr/bin/env bash
# shellcheck shell=bash
# Source-only: pin Cloud Run XAI_API_KEY to the latest ENABLED GSM version (not :latest).
#
# Cloud Run resolves :latest when a revision is created; stale revisions can keep an old
# disabled key after rotation. Every deploy should bind an explicit version number.
#
# Used by:
#   - scripts/ops/deploy-cloud-run-from-env.sh
#   - scripts/ops/deploy-atxfinance-backend-{staging,production}.sh
#   - .github/workflows/deploy-cloud-run.yml
#   - .github/workflows/deploy-cloud-run-production.yml

# Returns the numeric version id of the newest ENABLED secret version.
resolve_gcp_secret_enabled_version() {
  local project="$1"
  local secret_name="$2"
  local version=""

  version="$(
    gcloud secrets versions list "${secret_name}" \
      --project="${project}" \
      --filter="state:ENABLED" \
      --sort-by=~createTime \
      --limit=1 \
      --format='value(name)' 2>/dev/null || true
  )"

  if [[ -z "${version}" ]]; then
    echo "cloud-run-xai-secret-binding: no ENABLED GSM version for ${secret_name} in ${project}" >&2
    return 1
  fi

  printf '%s' "${version}"
}

# Cloud Run --set-secrets fragment: XAI_API_KEY=XAI_API_KEY:<version>
cloud_run_xai_api_key_binding() {
  local project="$1"
  local version=""

  version="$(resolve_gcp_secret_enabled_version "${project}" "XAI_API_KEY")"
  printf 'XAI_API_KEY=XAI_API_KEY:%s' "${version}"
}

# Prepend pinned XAI_API_KEY binding to a comma-separated SECRETS string; prints result on stdout.
cloud_run_secrets_prepend_xai_api_key() {
  local project="$1"
  local secrets="$2"
  local binding=""

  binding="$(cloud_run_xai_api_key_binding "${project}")"
  echo "cloud-run-xai-secret-binding: pinned ${binding}" >&2
  printf '%s,%s' "${binding}" "${secrets}"
}
