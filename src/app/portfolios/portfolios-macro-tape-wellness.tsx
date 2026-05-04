"use client";

import { useEffect, useState } from "react";

import { MacroTapeDeskNav } from "@/app/portfolios/macro-tape-desk-nav";
import { pickHealthTipForLocalDate } from "@/lib/desk-wellness-health-tips";

type Props = {
  visiblePathPrefixes?: string[];
  deskPortfolioId?: string | null;
};

export function PortfoliosMacroTapeWellness({ visiblePathPrefixes, deskPortfolioId }: Props) {
  const [weatherLine, setWeatherLine] = useState<string>("Loading desk brief…");
  const [wellnessLine, setWellnessLine] = useState<string>(
    pickHealthTipForLocalDate(new Date())
  );
  const [geoHint, setGeoHint] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const finishWithFallback = () => {
        setWeatherLine("Weather unavailable — try xChat with web search for a live lookup.");
        setWellnessLine(pickHealthTipForLocalDate(new Date()));
        setGeoHint("");
      };

      const params = new URLSearchParams();
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              params.set("lat", String(pos.coords.latitude));
              params.set("lon", String(pos.coords.longitude));
              setGeoHint("Live web search using your approximate location.");
              resolve();
            },
            () => {
              setGeoHint("Live web search — default city when location isn’t shared.");
              resolve();
            },
            { enableHighAccuracy: false, maximumAge: 600_000, timeout: 8_000 }
          );
        });
      } else if (typeof navigator !== "undefined") {
        setGeoHint("Live web search — default city when browser location isn’t available.");
      }

      if (cancelled) {
        return;
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
        if (!res.ok || !body.data?.weatherLine || !body.data?.wellnessLine) {
          finishWithFallback();
          return;
        }
        setWeatherLine(body.data.weatherLine);
        setWellnessLine(body.data.wellnessLine);
      } catch {
        if (!cancelled) {
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
            {geoHint ? (
              <p className="portfolios-macro-tape__wellness-micro">{geoHint}</p>
            ) : null}
          </div>
          <div className="portfolios-macro-tape__wellness-col portfolios-macro-tape__wellness-col--tip">
            <span className="portfolios-macro-tape__wellness-kicker">Wellness tip</span>
            <p className="portfolios-macro-tape__wellness-text">{wellnessLine}</p>
            <p className="portfolios-macro-tape__wellness-micro">Desk tips are educational only — not medical advice.</p>
          </div>
        </div>
        <MacroTapeDeskNav deskPortfolioId={deskPortfolioId} visiblePathPrefixes={visiblePathPrefixes} />
      </div>
    </div>
  );
}
