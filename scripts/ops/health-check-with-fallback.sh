#!/usr/bin/env bash
set -euo pipefail

LABEL_PREFIX="${1:-}"
BASE_URL="${2:-}"
SERVICE_NAME="${3:-}"
REGION="${4:-}"
ATTEMPTS="${5:-18}"
SLEEP_SECONDS="${6:-15}"

if [ -z "${LABEL_PREFIX}" ] || [ -z "${BASE_URL}" ] || [ -z "${SERVICE_NAME}" ] || [ -z "${REGION}" ]; then
  echo "usage: health-check-with-fallback.sh <label_prefix> <base_url> <service_name> <region> [attempts] [sleep_seconds]"
  exit 2
fi

health_check_with_retry() {
  local label="$1"
  local url="$2"
  local attempts="$3"
  local sleep_seconds="$4"

  for attempt in $(seq 1 "${attempts}"); do
    local response_file
    response_file="$(mktemp)"
    local http_code
    http_code="$(
      curl --silent --show-error --location \
        --connect-timeout 5 --max-time 15 \
        --output "${response_file}" --write-out "%{http_code}" \
        "${url}" || true
    )"
    local response_body
    response_body="$(tr -d '\n' < "${response_file}")"

    if [ "${http_code}" = "200" ] && [[ "${response_body}" == *"\"status\":\"ok\""* ]]; then
      rm -f "${response_file}"
      echo "${label}:ok attempt=${attempt}"
      return 0
    fi

    rm -f "${response_file}"
    echo "${label}:pending attempt=${attempt}/${attempts} status=${http_code:-curl_error}"
    if [ "${attempt}" -lt "${attempts}" ]; then
      sleep "${sleep_seconds}"
    fi
  done

  echo "${label}:failed after ${attempts} attempts"
  return 1
}

if health_check_with_retry "${LABEL_PREFIX}_custom_domain_health" "${BASE_URL}/api/health" "${ATTEMPTS}" "${SLEEP_SECONDS}"; then
  echo "${LABEL_PREFIX}_health_check:custom_domain_ok"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### ${LABEL_PREFIX} health check"
      echo "- custom domain: success"
      echo "- url: ${BASE_URL}/api/health"
    } >> "${GITHUB_STEP_SUMMARY}"
  fi
else
  echo "${LABEL_PREFIX}_custom_domain_health:falling back to run.app URL"
  SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"
  health_check_with_retry "${LABEL_PREFIX}_run_app_health" "${SERVICE_URL}/api/health" "${ATTEMPTS}" "${SLEEP_SECONDS}"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### ${LABEL_PREFIX} health check"
      echo "- custom domain: failed (fallback used)"
      echo "- fallback url: ${SERVICE_URL}/api/health"
    } >> "${GITHUB_STEP_SUMMARY}"
  fi
fi
