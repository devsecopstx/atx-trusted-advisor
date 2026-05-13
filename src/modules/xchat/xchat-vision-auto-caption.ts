import { readXaiVisionModelOverrideFromEnv } from "@/lib/env";
import { respondWithXaiToolLoop } from "@/lib/xai";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";

const CAPTION_SYSTEM =
  "You write short finance-oriented captions for xChat image attachments. Output plain text only, no markdown.";

const CAPTION_USER =
  "In at most 400 characters, describe what is visible (tickers, options chains, charts, portfolio UI). If unrelated to markets, reply exactly: Non-finance image.";

/**
 * One-shot xAI vision caption for pasted images when the user sends no text (audit-friendly log line).
 */
export async function generateXchatVisionAutoCaption(input: {
  imageDataUrls: string[];
  signal?: AbortSignal;
}): Promise<string> {
  const urls = input.imageDataUrls.map((u) => u.trim()).filter((u) => u.length > 0);
  if (urls.length === 0) {
    return "";
  }
  const model = readXaiVisionModelOverrideFromEnv() ?? getDefaultPersonaChatModelId();
  const result = await respondWithXaiToolLoop({
    model,
    systemPrompt: CAPTION_SYSTEM,
    userPrompt: CAPTION_USER,
    userImageDataUrls: urls,
    tools: [],
    toolChoice: "none",
    maxTurns: 1,
    executor: async () => ({ result: "", error: "no_local_tools_in_caption_pass" }),
    signal: input.signal
  });
  const text = result.outputText.trim();
  return text.length > 800 ? `${text.slice(0, 800)}…` : text;
}
