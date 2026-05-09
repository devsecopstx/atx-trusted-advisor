"use client";

import { useState } from "react";

import { MarketVeilBackground } from "@/components/animations/MarketVeilBackground";

const DEFAULT_OPACITY = 0.14;
const DEFAULT_GRID_SPEED = 1.0;
const DEFAULT_PARTICLE_COUNT = 28;
const DEFAULT_SKYLINE_OPACITY = 0.22;
const DEFAULT_SKYLINE_FILTER = "grayscale(100%) contrast(0.92) brightness(1.05)";

export function DevVeilClient() {
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [gridSpeed, setGridSpeed] = useState(DEFAULT_GRID_SPEED);
  const [particleCount, setParticleCount] = useState(DEFAULT_PARTICLE_COUNT);
  const [accent, setAccent] = useState<string>("");
  const [skylineOn, setSkylineOn] = useState(true);
  const [overlayOn, setOverlayOn] = useState(true);
  const [skylineOpacity, setSkylineOpacity] = useState(DEFAULT_SKYLINE_OPACITY);
  const [skylineFilter, setSkylineFilter] = useState(DEFAULT_SKYLINE_FILTER);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#f1f5f9",
        padding: "1.5rem",
        fontFamily: "system-ui, sans-serif",
        position: "relative"
      }}
    >
      <MarketVeilBackground
        accent={accent.trim() || undefined}
        gridSpeed={gridSpeed}
        opacity={opacity}
        overlay={overlayOn ? undefined : null}
        particleCount={particleCount}
        skylineFilter={skylineFilter.trim() || undefined}
        skylineOpacity={skylineOpacity}
        skylineSrc={skylineOn ? undefined : null}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 720,
          background: "rgba(5,5,5,0.78)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "1.25rem 1.5rem"
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: "1.4rem" }}>Ambient Market Veil — dev preview</h1>
        <p style={{ color: "#94a3b8", marginBottom: "1.25rem", fontSize: "0.85rem", lineHeight: 1.6 }}>
          Tweak knobs to feel the breathing grid + drift + ticks. Production tenants opt out via{" "}
          <code>tenantPreferences.ambient_market_veil = false</code>. Open dev tools → Performance to confirm{" "}
          <strong>≤ 1.2 ms / frame</strong>; throttle CPU to 6× to verify the FPS auto-throttle kicks in (target
          drops from {DEFAULT_PARTICLE_COUNT} when avg FPS &lt; 45).
        </p>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>
              <strong>--veil-opacity</strong>: {opacity.toFixed(3)}
            </span>
            <input
              max={0.6}
              min={0}
              step={0.01}
              type="range"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>
              <strong>--veil-grid-speed</strong>: {gridSpeed.toFixed(2)}× (52 s breathing cycle)
            </span>
            <input
              max={3}
              min={0.25}
              step={0.05}
              type="range"
              value={gridSpeed}
              onChange={(e) => setGridSpeed(Number(e.target.value))}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>
              <strong>--veil-particle-count</strong>: {particleCount}
            </span>
            <input
              max={96}
              min={8}
              step={1}
              type="range"
              value={particleCount}
              onChange={(e) => setParticleCount(Number(e.target.value))}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>
              <strong>accent</strong> (optional hex; blank → tenant accent → built-in teal)
            </span>
            <input
              placeholder="#39ff14"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                color: "#f1f5f9",
                padding: "0.4rem 0.55rem",
                fontFamily: "monospace"
              }}
              type="text"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
            />
          </label>
          <label style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", fontSize: "0.85rem" }}>
            <input checked={skylineOn} type="checkbox" onChange={(e) => setSkylineOn(e.target.checked)} />
            <span>
              <strong>skyline image</strong> (Austin <code>/branding/atx-skyline.jpg</code>)
            </span>
          </label>
          <label style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", fontSize: "0.85rem" }}>
            <input checked={overlayOn} type="checkbox" onChange={(e) => setOverlayOn(e.target.checked)} />
            <span>
              <strong>readability overlay</strong> (top-down 0.32→0.58 dim)
            </span>
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>
              <strong>skyline opacity</strong>: {skylineOpacity.toFixed(2)} (0.15–0.30 = quiet watermark)
            </span>
            <input
              max={0.6}
              min={0}
              step={0.01}
              type="range"
              value={skylineOpacity}
              onChange={(e) => setSkylineOpacity(Number(e.target.value))}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.85rem" }}>
            <span>
              <strong>skyline filter</strong> (any CSS <code>filter</code> chain; default grayscale watermark)
            </span>
            <input
              placeholder="grayscale(100%) contrast(0.92) brightness(1.05)"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                color: "#f1f5f9",
                padding: "0.4rem 0.55rem",
                fontFamily: "monospace"
              }}
              type="text"
              value={skylineFilter}
              onChange={(e) => setSkylineFilter(e.target.value)}
            />
          </label>
        </div>

        <hr style={{ borderColor: "rgba(255,255,255,0.08)", margin: "1.25rem 0" }} />

        <ul style={{ color: "#94a3b8", fontSize: "0.8rem", lineHeight: 1.6, paddingLeft: "1.1rem" }}>
          <li>Setup defers until window.load + idle hop (TBT-safe).</li>
          <li>Hidden tab → RAF pauses on visibilitychange.</li>
          <li>prefers-reduced-motion → single static frame, no RAF.</li>
          <li>Coarse pointer → mouse parallax disabled, particle target capped to ≤ 18.</li>
        </ul>
      </div>
    </div>
  );
}
