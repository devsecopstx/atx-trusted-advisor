import { pickHealthTipForLocalDate } from "@/lib/desk-wellness-health-tips";
import { respondWithXai } from "@/lib/xai";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";

const DESK_WELLNESS_SYSTEM = [
  "You are a concise assistant on the portfolio desk workspace.",
  "Use the web_search tool at least once to ground answers in current, verifiable web sources.",
  "Task A — Weather: one short line with approximate conditions and temperature (with unit) for the user's location context and today's date. No hour-by-hour forecast.",
  "Task B — Wellness: one short line with a practical desk-worker habit (movement, hydration, eyes, posture, stress breaks). Educational only — not medical diagnosis or treatment.",
  "Do not give investment advice. Keep total reasoning tight.",
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
  const weatherLine = afterW.slice(0, endWeather).trim().replace(/\s+/g, " ").slice(0, 320);
  const wellnessRest = afterW.slice(endWeather + openH.length).trim();
  const wellnessLine = wellnessRest.replace(/\s+/g, " ").slice(0, 420);
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
      weatherLine: lines[0]!.slice(0, 320),
      wellnessLine: lines[1]!.slice(0, 420),
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
    return hit.value;
  }

  const userPrompt = [
    `Today's date (ISO): ${input.isoDate}`,
    `Location context for weather search: ${input.locationDescription}`,
    "",
    "Search the web as needed, then reply using ONLY the <<<WEATHER>>> / <<<WELLNESS>>> tagged format from your instructions."
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
      const value: DeskWellnessBriefResult = {
        weatherLine: tagged.weatherLine,
        wellnessLine: tagged.wellnessLine,
        parsed: true
      };
      memoryCache.set(key, { exp: now + MEMORY_TTL_MS, value });
      return value;
    }

    const soft = softParseLines(result.outputText);
    if (soft) {
      memoryCache.set(key, { exp: now + MEMORY_TTL_MS, value: soft });
      return soft;
    }
  } catch {
    /* fall through */
  }

  const fb = fallbackBrief();
  memoryCache.set(key, { exp: now + Math.min(MEMORY_TTL_MS, 5 * 60 * 1000), value: fb });
  return fb;
}
