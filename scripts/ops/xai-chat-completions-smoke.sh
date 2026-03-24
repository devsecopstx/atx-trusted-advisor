#!/usr/bin/env bash
# Smoke-test xAI chat completions with the runtime API key (same path as xChat).
# Usage: from repo root — npm run smoke:xai-chat
# Env: XAI_API_KEY (required). Optional: XAI_SMOKE_MODEL (default grok-4-1-fast), XAI_CHAT_COMPLETIONS_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${XAI_API_KEY:-}" ]; then
  echo "xai-chat-completions-smoke: set XAI_API_KEY or add it to .env" >&2
  exit 2
fi

URL="${XAI_CHAT_COMPLETIONS_URL:-https://api.x.ai/v1/chat/completions}"
export XAI_SMOKE_MODEL="${XAI_SMOKE_MODEL:-grok-4-1-fast}"

PAYLOAD="$(
  node -e "
    const model = process.env.XAI_SMOKE_MODEL;
    console.log(JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a test assistant.' },
        { role: 'user', content: 'Testing. Just say hi and hello world and nothing else.' }
      ],
      model,
      stream: false,
      temperature: 0
    }));
  "
)"

tmp="$(mktemp)"
cleanup() { rm -f "${tmp}"; }
trap cleanup EXIT

http_code="$(
  curl -sS --fail-with-body \
    -o "${tmp}" \
    -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${XAI_API_KEY}" \
    -d "${PAYLOAD}" \
    "${URL}" || true
)"

if [ "${http_code}" != "200" ]; then
  echo "xai-chat-completions-smoke: HTTP ${http_code}" >&2
  cat "${tmp}" >&2
  exit 1
fi

echo "xai-chat-completions-smoke: ok model=${XAI_SMOKE_MODEL} http=${http_code}"
if command -v node >/dev/null 2>&1; then
  node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const text = j.choices?.[0]?.message?.content ?? j;
    console.log(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
  " "${tmp}"
else
  cat "${tmp}"
fi
