import Image from "next/image";

import { SkylineTimeBoot } from "@/components/SkylineTimeBoot";

const SKYLINE_WIDTH = 1536;
const SKYLINE_HEIGHT = 672;

export function FullBleedBackground() {
  return (
    <div className="fixed inset-0 z-[-40] overflow-hidden pointer-events-none" aria-hidden>
      <SkylineTimeBoot />
      <div className="absolute inset-0 bg-[#F1F5F9] dark:bg-[#0B0F14]" />
      <div className="xf-skyline-bleed" aria-hidden>
        <Image
          alt=""
          aria-hidden
          className="xf-skyline-layer xf-skyline-layer--day"
          decoding="async"
          height={SKYLINE_HEIGHT}
          priority
          src="/branding/atx-skyline-day.png"
          width={SKYLINE_WIDTH}
        />
        <Image
          alt=""
          aria-hidden
          className="xf-skyline-layer xf-skyline-layer--night"
          decoding="async"
          height={SKYLINE_HEIGHT}
          priority
          src="/branding/atx-skyline-night.png"
          width={SKYLINE_WIDTH}
        />
      </div>
      <div className="absolute inset-0 starfield starfield--grid" aria-hidden />
      <div className="absolute inset-0 starfield starfield--stars-a" aria-hidden />
      <div className="absolute inset-0 starfield starfield--stars-b" aria-hidden />
      <div className="absolute inset-0 starfield starfield--stars-c" aria-hidden />
      <div className="absolute inset-0 starfield starfield--accent-a" aria-hidden />
      <div className="absolute inset-0 starfield starfield--accent-b" aria-hidden />
    </div>
  );
}
