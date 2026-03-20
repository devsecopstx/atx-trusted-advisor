---
id: xlitellm-xai-proxy
name: xlitellm-xai-proxy
description: Starts and verifies a local LiteLLM proxy for Cursor using xAI Grok aliases. Use when the user asks to run LiteLLM, configure Cursor with a local OpenAI-compatible endpoint, or validate grok-code-fast, grok-code-fast-1, and grok-imagine-image-pro routes.
---

# LiteLLM xAI Proxy

## Goal

Run LiteLLM on port `4000` using `~/litellm-config.yaml` with these aliases:

- `grok-code-fast`
- `grok-code-fast-1`
- `grok-imagine-image-pro`

## Preconditions

- `~/litellm-config.yaml` exists and includes the aliases above.
- `XAI_API_KEY` is set in the current shell.
- `LITELLM_MASTER_KEY` is set (recommended for authenticated local proxy access).

## Start Workflow

1) Export required environment variables:

```bash
export XAI_API_KEY="<new_xai_key_here>"
export LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-$(openssl rand -hex 32)}"
```

1) Start the proxy:

```bash
litellm --config ~/litellm-config.yaml --port 4000
```

1) Verify model registry in a new terminal:

```bash
curl http://localhost:4000/v1/models
```

1) Verify chat completion path:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"grok-code-fast",
    "messages":[{"role":"user","content":"reply with ok"}]
  }'
```

## Cursor Connection

- Base URL: `http://localhost:4000/v1`
- API key: `LITELLM_MASTER_KEY` value
- Default code model: `grok-code-fast`
- Manual fallback model: `grok-code-fast-1`

## Safety Notes

- Never hardcode real API keys in committed files.
- If auth errors occur, confirm Cursor API key exactly matches `LITELLM_MASTER_KEY`.
- If model errors occur, confirm alias names in `~/litellm-config.yaml` and restart LiteLLM.
