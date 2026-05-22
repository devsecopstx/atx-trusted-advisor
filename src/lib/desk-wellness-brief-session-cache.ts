const STORAGE_KEY = "xf.deskWellnessWeather.v1";

type DeskWellnessWeatherCacheEntry = {
  dayKey: string;
  locationKey: string;
  weatherLine: string;
};

function todayDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Stable bucket for coords (~1 km) or default city. */
export function deskWellnessLocationKey(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) {
    return "default";
  }
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

export function readDeskWellnessWeatherSessionCache(
  locationKey: string
): string | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DeskWellnessWeatherCacheEntry;
    if (
      parsed.dayKey !== todayDayKey() ||
      parsed.locationKey !== locationKey ||
      typeof parsed.weatherLine !== "string" ||
      !parsed.weatherLine.trim()
    ) {
      return null;
    }
    return parsed.weatherLine.trim();
  } catch {
    return null;
  }
}

export function writeDeskWellnessWeatherSessionCache(
  locationKey: string,
  weatherLine: string
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  const line = weatherLine.trim();
  if (!line) {
    return;
  }
  try {
    const entry: DeskWellnessWeatherCacheEntry = {
      dayKey: todayDayKey(),
      locationKey,
      weatherLine: line
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}
