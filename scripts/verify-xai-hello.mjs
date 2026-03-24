#!/usr/bin/env node
/**
 * Minimal xAI sanity checks (same keys as runtime xChat / collections).
 * - With XAI_API_KEY: POST /v1/chat/completions one-shot "hello world".
 * - With XAI_MANAGEMENT_API_KEY: GET management /v1/collections (list).
 * Exit 0 if checks pass or all relevant keys are unset (skip).
 * Exit 1 if a key is set but the upstream call fails.
 *
 * Env: SKIP_XAI_POST_SEED_VERIFY=1 skips entirely (used when orchestrating elsewhere).
 * Optional: XAI_BASE_URL, XAI_MANAGEMENT_BASE_URL, XAI_CHAT_MODEL, XAI_VERIFY_MODEL.
 */
const skipFlag = String(process.env.SKIP_XAI_POST_SEED_VERIFY ?? "").toLowerCase();
if (skipFlag === "1" || skipFlag === "true" || skipFlag === "yes") {
  console.log("[verify-xai-hello] skip (SKIP_XAI_POST_SEED_VERIFY)");
  process.exit(0);
}

const apiKey = process.env.XAI_API_KEY?.trim();
const mgmtKey = process.env.XAI_MANAGEMENT_API_KEY?.trim();

if (!apiKey && !mgmtKey) {
  console.warn(
    "[verify-xai-hello] skip: XAI_API_KEY and XAI_MANAGEMENT_API_KEY unset — configure .env before using xChat / RAG."
  );
  process.exit(0);
}

function trimBase(raw, fallback) {
  return (raw?.trim() || fallback).replace(/\/$/, "");
}

async function verifyChatCompletions() {
  const base = trimBase(process.env.XAI_BASE_URL, "https://api.x.ai/v1");
  const model =
    process.env.XAI_VERIFY_MODEL?.trim() ||
    process.env.XAI_CHAT_MODEL?.trim() ||
    "grok-4-1-fast-reasoning";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      stream: false,
      messages: [
        { role: "system", content: "You are a terse test assistant." },
        { role: "user", content: "Reply with exactly: hello world" }
      ]
    })
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[verify-xai-hello] chat/completions HTTP ${res.status}: ${text.slice(0, 800)}`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("[verify-xai-hello] chat/completions: response is not JSON");
    process.exit(1);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("[verify-xai-hello] chat/completions: missing assistant message", data);
    process.exit(1);
  }
  const preview = content.trim().slice(0, 120);
  console.log(`[verify-xai-hello] chat/completions ok model=${model} reply=${JSON.stringify(preview)}`);
}

async function verifyManagementCollections() {
  const base = trimBase(process.env.XAI_MANAGEMENT_BASE_URL, "https://management-api.x.ai/v1");
  const res = await fetch(`${base}/collections`, {
    headers: { Authorization: `Bearer ${mgmtKey}` }
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[verify-xai-hello] management GET /collections HTTP ${res.status}: ${text.slice(0, 800)}`);
    process.exit(1);
  }
  try {
    JSON.parse(text);
  } catch {
    console.error("[verify-xai-hello] management /collections: response is not JSON");
    process.exit(1);
  }
  console.log("[verify-xai-hello] management /collections ok");
}

async function main() {
  if (apiKey) {
    await verifyChatCompletions();
  }
  if (mgmtKey) {
    await verifyManagementCollections();
  }
  console.log("[verify-xai-hello] all configured checks passed");
}

main().catch((e) => {
  console.error("[verify-xai-hello]", e instanceof Error ? e.message : e);
  process.exit(1);
});
