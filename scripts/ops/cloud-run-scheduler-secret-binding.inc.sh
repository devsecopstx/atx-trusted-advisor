#!/usr/bin/env bash
# shellcheck shell=bash
# Source-only: append ATX_SCHEDULER_INTERNAL_SECRET to SECRETS when present in GCP.
# Next Cloud Run needs this for POST /api/internal/scheduler/execute-task (Spring delegate).
# Requires: SECRETS, PROJECT set by caller.

cloud_run_append_scheduler_internal_secret_binding() {
  if gcloud secrets describe ATX_SCHEDULER_INTERNAL_SECRET --project="${PROJECT}" --format='value(name)' >/dev/null 2>&1; then
    SECRETS="${SECRETS},ATX_SCHEDULER_INTERNAL_SECRET=ATX_SCHEDULER_INTERNAL_SECRET:latest"
    echo "${1:-deploy}: binding ATX_SCHEDULER_INTERNAL_SECRET (scheduler execute-task delegate)"
  else
    echo "${1:-deploy}: ATX_SCHEDULER_INTERNAL_SECRET absent — sync: npm run ops:secrets:sync-scheduler-delegate:prod (or :staging)" >&2
  fi
}
