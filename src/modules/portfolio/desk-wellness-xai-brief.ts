import { pickHealthTipForLocalDate } from "@/lib/desk-wellness-health-tips";
import { respondWithXai } from "@/lib/xai";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";

const DESK_WELLNESS_SYSTEM = [
  "You are a concise assistant on the portfolio desk workspace.",
  "Use the web_search tool at least once to ground answers in current conditions.",
  "Task A — Weather: one friendly sentence — conditions plus temperature for the user's location and today's date (Imperial primary, optional metric in parentheses). Example tone: \"Mostly sunny, high near 83°F (28°C).\" No hour-by-hour forecast. No city name required unless it reads naturally.",
  "Task B — Wellness: one short line with a practical desk-worker habit (movement, hydration, eyes, posture, stress breaks). Educational only — not medical diagnosis or treatment.",
  "Do not give investment advice. Keep total reasoning tight.",
  "Neither line may contain URLs, markdown links, footnotes, or citation markers — no [[1]](...), no [text](https://...), no bracketed source lists. Plain readable prose only.",
  "",
  "Output EXACTLY this tagged plain-text shape (no markdown fences, no text outside the tags):",
  "<<<WEATHER>>>",
  "single line here",
  "<<<WELLNESS>>>",
  "single line here"
].join("\n");

export type DeskWellnessBriefResult = {
  weatherLine: string;
  wellnessLine: string;
  /** True when tags parsed cleanly from the model output. */
  parsed: boolean;
};

const WEATHER_MAX = 320;
const WELLNESS_MAX = 420;

/**
 * Removes web_search / model citation tails so desk tape stays readable (no [[1]](url) clusters).
 * Exported for unit tests.
 */
export function sanitizeDeskWellnessLine(line: string, maxLen: number): string {
  let s = line.trim();
  s = s.replace(/\s*\[\[\d+\]\]\([^)]*\)/g, "");
  s = s.replace(/\s*\[\d+\]\([^)]*\)/g, "");
  s = s.replace(/\s*\[@citation:[^\]]+\]/gi, "");
  s = s.replace(/\s*\[@tool:[^\]]+\]/gi, "");
  return s.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeBriefResult(value: DeskWellnessBriefResult): DeskWellnessBriefResult {
  const weatherLine = sanitizeDeskWellnessLine(value.weatherLine, WEATHER_MAX);
  const wellnessLine = sanitizeDeskWellnessLine(value.wellnessLine, WELLNESS_MAX);
  return {
    weatherLine: weatherLine || "Weather summary unavailable.",
    wellnessLine: wellnessLine || pickHealthTipForLocalDate(new Date()),
    parsed: value.parsed
  };
}

/** Exported for unit tests — extracts tagged segments from model output. */
export function parseDeskWellnessTaggedOutput(raw: string): { weatherLine: string; wellnessLine: string } | null {
  const text = raw.trim();
  const openW = "<<<WEATHER>>>";
  const openH = "<<<WELLNESS>>>";
  const iW = text.indexOf(openW);
  const iH = text.indexOf(openH);
  if (iW < 0 || iH < 0 || iH <= iW) {
    return null;
  }
  const afterW = text.slice(iW + openW.length).trimStart();
  const endWeather = afterW.indexOf(openH);
  if (endWeather < 0) {
    return null;
  }
  const weatherLine = sanitizeDeskWellnessLine(afterW.slice(0, endWeather), WEATHER_MAX);
  const wellnessLine = sanitizeDeskWellnessLine(afterW.slice(endWeather + openH.length), WELLNESS_MAX);
  if (!weatherLine || !wellnessLine) {
    return null;
  }
  return { weatherLine, wellnessLine };
}

function fallbackBrief(): DeskWellnessBriefResult {
  return {
    weatherLine: "Weather lookup unavailable — open xChat with web_search when you need a live check.",
    wellnessLine: pickHealthTipForLocalDate(new Date()),
    parsed: false
  };
}

function softParseLines(raw: string): DeskWellnessBriefResult | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length >= 2) {
    return {
      weatherLine: sanitizeDeskWellnessLine(lines[0]!, WEATHER_MAX),
      wellnessLine: sanitizeDeskWellnessLine(lines[1]!, WELLNESS_MAX),
      parsed: false
    };
  }
  return null;
}

type CacheEntry = { exp: number; value: DeskWellnessBriefResult };
const memoryCache = new Map<string, CacheEntry>();
const MEMORY_TTL_MS = 22 * 60 * 1000;
const MAX_CACHE = 400;

function pruneMemoryCache(): void {
  const now = Date.now();
  for (const [k, v] of memoryCache) {
    if (v.exp <= now) {
      memoryCache.delete(k);
    }
  }
  while (memoryCache.size > MAX_CACHE) {
    const first = memoryCache.keys().next().value;
    if (!first) break;
    memoryCache.delete(first);
  }
}

function cacheKey(userId: string, dayKey: string, locationKey: string): string {
  return `${userId}:${dayKey}:${locationKey}`;
}

export async function fetchDeskWellnessBriefViaXai(input: {
  userId: string;
  locationDescription: string;
  isoDate: string;
}): Promise<DeskWellnessBriefResult> {
  const dayKey = input.isoDate.slice(0, 10);
  const locationKey = input.locationDescription.trim().slice(0, 240);
  const key = cacheKey(input.userId, dayKey, locationKey);
  const now = Date.now();
  pruneMemoryCache();
  const hit = memoryCache.get(key);
  if (hit && hit.exp > now) {
    return normalizeBriefResult(hit.value);
  }

  const userPrompt = [
    `Today's date (ISO): ${input.isoDate}`,
    `Location context for weather search: ${input.locationDescription}`,
    "",
    "Search the web as needed, then reply using ONLY the <<<WEATHER>>> / <<<WELLNESS>>> tagged format from your instructions.",
    "Do not append URLs, footnotes, or [[n]](...) citation tails to either line."
  ].join("\n");

  try {
    const result = await respondWithXai({
      model: getDefaultPersonaChatModelId(),
      systemPrompt: DESK_WELLNESS_SYSTEM,
      userPrompt,
      tools: [{ type: "web_search", name: "web_search" }] as Array<Record<string, unknown>>,
      toolChoice: "auto",
      maxTurns: 12
    });

    const tagged = parseDeskWellnessTaggedOutput(result.outputText);
    if (tagged) {
      const value = normalizeBriefResult({
        weatherLine: tagged.weatherLine,
        wellnessLine: tagged.wellnessLine,
        parsed: true
      });
      memoryCache.set(key, { exp: now + MEMORY_TTL_MS, value });
      return value;
    }

    const soft = softParseLines(result.outputText);
    if (soft) {
      const normalized = normalizeBriefResult(soft);
      memoryCache.set(key, { exp: now + MEMORY_TTL_MS, value: normalized });
      return normalized;
    }
  } catch {
    /* fall through */
  }

  const fb = normalizeBriefResult(fallbackBrief());
  memoryCache.set(key, { exp: now + Math.min(MEMORY_TTL_MS, 5 * 60 * 1000), value: fb });
  return fb;
}
