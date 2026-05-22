"use client";

import { useEffect, useState } from "react";

import { MacroTapeDeskNav } from "@/app/portfolios/macro-tape-desk-nav";
import {
    deskWellnessLocationKey,
    readDeskWellnessWeatherSessionCache,
    writeDeskWellnessWeatherSessionCache
} from "@/lib/desk-wellness-brief-session-cache";
import { pickHealthTipForLocalDate } from "@/lib/desk-wellness-health-tips";

type Props = {
  visiblePathPrefixes?: string[];
  deskPortfolioId?: string | null;
};

export function PortfoliosMacroTapeWellness({ visiblePathPrefixes, deskPortfolioId }: Props) {
  const [weatherLine, setWeatherLine] = useState<string>("Loading today's weather…");
  const [wellnessLine, setWellnessLine] = useState<string>(
    pickHealthTipForLocalDate(new Date())
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveGeoParams(): Promise<URLSearchParams> {
      const params = new URLSearchParams();
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return params;
      }
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            params.set("lat", String(pos.coords.latitude));
            params.set("lon", String(pos.coords.longitude));
            resolve();
          },
          () => resolve(),
          { enableHighAccuracy: false, maximumAge: 600_000, timeout: 1_500 }
        );
      });
      return params;
    }

    async function run() {
      const finishWithFallback = () => {
        setWeatherLine("Weather unavailable — try xChat with web search for a live lookup.");
      };

      const params = await resolveGeoParams();
      if (cancelled) {
        return;
      }

      const lat = params.get("lat");
      const lon = params.get("lon");
      const latN = lat != null ? Number(lat) : null;
      const lonN = lon != null ? Number(lon) : null;
      const locationKey = deskWellnessLocationKey(
        latN != null && Number.isFinite(latN) ? latN : null,
        lonN != null && Number.isFinite(lonN) ? lonN : null
      );

      const cachedWeather = readDeskWellnessWeatherSessionCache(locationKey);
      if (cachedWeather) {
        setWeatherLine(cachedWeather);
      }

      try {
        const qs = params.toString();
        const url = qs ? `/api/portfolios/desk-wellness-brief?${qs}` : "/api/portfolios/desk-wellness-brief";
        const res = await fetch(url, { credentials: "include" });
        const body = (await res.json()) as {
          data?: { weatherLine?: string; wellnessLine?: string };
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!res.ok || !body.data?.weatherLine) {
          if (!cachedWeather) {
            finishWithFallback();
          }
          return;
        }
        setWeatherLine(body.data.weatherLine);
        writeDeskWellnessWeatherSessionCache(locationKey, body.data.weatherLine);
        if (body.data.wellnessLine?.trim()) {
          setWellnessLine(body.data.wellnessLine);
        }
      } catch {
        if (!cancelled && !cachedWeather) {
          finishWithFallback();
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="portfolios-macro-tape portfolios-macro-tape--wellness" aria-label="Desk weather and wellness">
      <div className="portfolios-macro-tape__inner portfolios-macro-tape__inner--wellness">
        <span className="portfolios-macro-tape__badge portfolios-macro-tape__badge--wellness">Desk pulse</span>
        <div className="portfolios-macro-tape__wellness-body">
          <div className="portfolios-macro-tape__wellness-col portfolios-macro-tape__wellness-col--weather">
            <span className="portfolios-macro-tape__wellness-kicker">Today&apos;s weather</span>
            <p className="portfolios-macro-tape__wellness-text portfolios-macro-tape__wellness-text--weather">
              {weatherLine}
            </p>
          </div>
          <div className="portfolios-macro-tape__wellness-col portfolios-macro-tape__wellness-col--tip">
            <span className="portfolios-macro-tape__wellness-kicker">Wellness tip</span>
            <p className="portfolios-macro-tape__wellness-text">{wellnessLine}</p>
          </div>
        </div>
        <MacroTapeDeskNav deskPortfolioId={deskPortfolioId} visiblePathPrefixes={visiblePathPrefixes} />
      </div>
    </div>
  );
}
