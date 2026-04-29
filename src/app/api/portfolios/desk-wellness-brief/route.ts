import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { fetchDeskWellnessBriefViaXai } from "@/modules/portfolio/desk-wellness-xai-brief";

function parseCoord(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

function buildLocationDescription(lat: number | null, lon: number | null): string {
  if (lat != null && lon != null) {
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return (
      `Approximate coordinates ${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew} ` +
      "(browser geolocation). Search the web for current local weather and conditions for today."
    );
  }
  return (
    "Geolocation not provided. Use Austin, Texas, USA as the reference city for today's weather web search."
  );
}

/**
 * GET /api/portfolios/desk-wellness-brief?lat=&lon=
 * Session-only: brief weather + desk wellness lines via xAI Responses + hosted **web_search** (no third-party weather API).
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  if (!isGlobalAdmin(session.roles) && !canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const latRaw = parseCoord(searchParams.get("lat"));
  const lonRaw = parseCoord(searchParams.get("lon"));
  let lat = latRaw;
  let lon = lonRaw;
  if (lat != null && (lat < -90 || lat > 90)) {
    lat = null;
  }
  if (lon != null && (lon < -180 || lon > 180)) {
    lon = null;
  }
  if (lat == null || lon == null) {
    lat = null;
    lon = null;
  }

  const locationDescription = buildLocationDescription(lat, lon);
  const isoDate = new Date().toISOString();

  const brief = await fetchDeskWellnessBriefViaXai({
    userId: session.userId,
    locationDescription,
    isoDate
  });
  return NextResponse.json({
    data: {
      weatherLine: brief.weatherLine,
      wellnessLine: brief.wellnessLine,
      parsed: brief.parsed
    }
  });
}
