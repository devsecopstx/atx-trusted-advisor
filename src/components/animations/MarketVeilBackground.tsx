"use client";

import { useEffect, useRef } from "react";

/**
 * `MarketVeilBackground` — ambient Austin-skyline veil for app_user product shells.
 *
 * **Visual stack (bottom → top, all inside one `position: fixed` wrapper at `z-index: -1`):**
 * 1. Tenant skyline image (`<img>`, default `/branding/atx-skyline.jpg`) — covers
 *    viewport with `object-position: center bottom` so the city silhouette + river
 *    stay anchored. Loads with `decoding="async"` + `fetchpriority="low"` so it
 *    never competes with critical product chrome for early bandwidth.
 * 2. Dark gradient overlay — top-down 0.55 → 0.78 dim so chat/desk text reads
 *    against the city. Tunable via `--veil-overlay`.
 * 3. Canvas2D layer — subtle teal grid (slow breathing cycle), drifting accent
 *    particles with occasional gold "tick" highlights, faint micro-connection
 *    lines between neighbour particles. Pure transparent canvas above the image.
 *
 * **Performance contract** (must hold — see `atx-docs/design-system/current-state-features.md`):
 * - Pure Canvas2D + `requestAnimationFrame`; zero new runtime deps.
 * - Skyline image is referenced as a regular `<img>` so the browser handles
 *   caching, decoding, and HTTP/2 multiplexing without competing with the LCP
 *   candidate (`fetchpriority="low"`).
 * - Setup + animation loop start are gated behind `window.load` + an idle hop
 *   so they never enter Lighthouse’s FCP → TTI window (TBT contract).
 * - Auto-throttles particle count when measured FPS drops below 45.
 * - Pauses on `document.visibilitychange === "hidden"` and on
 *   `prefers-reduced-motion: reduce` (no RAF, single static frame instead).
 * - `aria-hidden="true"` + `pointer-events: none` (purely decorative).
 *
 * **Tunables** (props *or* CSS custom properties — props win):
 * - `--veil-opacity` (default `0.09`) — canvas grid/particle alpha multiplier.
 * - `--veil-grid-speed` (default `1.0`) — multiplier on the 52 s breathing cycle.
 * - `--veil-particle-count` (default `28`) — desktop target; mobile clamps to ≤18.
 * - `--veil-bg-image` (default `url(/branding/atx-skyline.jpg)`) — tenant override
 *   accepts any CSS `image` value (including `none` to render canvas only).
 * - `--veil-overlay` (default `linear-gradient(180deg, rgba(5,5,5,0.55) 0%,
 *   rgba(5,5,5,0.78) 100%)`) — readability overlay above the skyline.
 *
 * **Mouse parallax** is desktop-only (skipped on coarse pointers) and capped
 * at ±5 px so it never crosses into a perceptible camera move.
 *
 * Mount once per route shell. Keep at `<MarketVeilBackground />` defaults
 * unless the tenant explicitly tunes the veil via CSS variables on `:root`
 * (preferred) or via props on this component.
 */

const DEFAULT_SKYLINE_SRC = "/branding/atx-skyline.jpg";
/**
 * Watermark-style image filter. Single source of truth for the “quiet
 * background” treatment on every theme — `grayscale(100%)` flattens the colour
 * city image into neutral tones (so the same JPG works for soft + deep + any
 * future tenant accent without per-theme assets) and `opacity 0.22` keeps the
 * skyline as a subtle hint behind product chrome (WCAG AA preserved against
 * `--xf-text-100` body copy thanks to the dark wrapper underlay).
 *
 * Tunable via the `skylineFilter` prop (e.g. tenants that want full colour back
 * can pass `none`). Stays inside the 15–30% opacity guidance.
 */
const DEFAULT_SKYLINE_FILTER = "grayscale(100%) contrast(0.92) brightness(1.05)";
const DEFAULT_SKYLINE_OPACITY = 0.22;
/**
 * Very light vignette so the dark wrapper colour bleeds through evenly under
 * the now-watermarked skyline. Without this, edges read pure black; with it,
 * the city has just enough atmosphere to read as the brand mark.
 */
const DEFAULT_OVERLAY_GRADIENT =
  "linear-gradient(180deg, rgba(5, 5, 5, 0.32) 0%, rgba(5, 5, 5, 0.42) 55%, rgba(5, 5, 5, 0.58) 100%)";

type MarketVeilBackgroundProps = {
  /** Override the global alpha multiplier (clamped 0…0.6); else reads `--veil-opacity` (default `0.09`). */
  opacity?: number;
  /** Multiplier on the breathing cycle speed (clamped 0.25…3); else reads `--veil-grid-speed` (default `1.0`). */
  gridSpeed?: number;
  /**
   * Target particle count on desktop (clamped 8…96); else reads `--veil-particle-count` (default `28`).
   * Mobile auto-scales to `min(count, 18)`. Auto-throttle may reduce further when FPS < 45.
   */
  particleCount?: number;
  /** Optional className — appended to the fixed-position background canvas wrapper. */
  className?: string;
  /** Optional accent color override (`hsl()` / `#rrggbb`); else reads `--veil-accent` → `--xf-tenant-accent` → built-in teal. */
  accent?: string;
  /**
   * Override the skyline `<img>` source. Pass `null` (or set `--veil-bg-image: none`)
   * to render only the canvas/overlay (e.g. tenants without a custom skyline).
   * Defaults to `/branding/atx-skyline.jpg`.
   */
  skylineSrc?: string | null;
  /**
   * Override the dark overlay above the skyline. Any valid CSS `background`
   * value; defaults to a top-down 0.55 → 0.78 dim. Pass `null` for none.
   */
  overlay?: string | null;
  /**
   * Override the CSS `filter` applied to the skyline `<img>`. Default is a
   * grayscale watermark treatment; pass `none` for full colour, or any valid
   * `filter` chain (`saturate(0) blur(1px)` etc.).
   */
  skylineFilter?: string;
  /**
   * Override the skyline `<img>` opacity (0–1). Clamped to 0…1; default `0.22`
   * (sits inside the 15–30% “quiet watermark” guidance).
   */
  skylineOpacity?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  noiseSeed: number;
  flashUntil: number;
};

type ConnectionEdge = {
  from: number;
  to: number;
};

type ScheduleHandle = { cancel: () => void };

// Bumped from 0.09 to 0.14 so the breathing grid + particles read against the
// skyline image (previously the network was nearly invisible on dark theme).
// Auto-throttle still owns the upper bound — never raise this past ~0.22.
const DEFAULT_OPACITY = 0.14;
const DEFAULT_GRID_SPEED = 1.0;
const DEFAULT_PARTICLE_COUNT = 28;
const PARALLAX_MAX_PX = 5;
const FPS_THROTTLE_THRESHOLD = 45;
const FPS_SAMPLE_FRAMES = 60;
const GRID_BREATHING_SECONDS = 52;
// Cadence calibrated against Grok Imagine reference: ticks fire frequently
// enough to feel like a live data feed (every 2.4–4.8 s) without becoming
// distracting. Pulses (network "burst") happen 5–10 s apart with a longer
// 300 ms lift so the full edge graph reads.
const TICK_INTERVAL_MIN_MS = 2_400;
const TICK_INTERVAL_MAX_MS = 4_800;
const TICK_FLASH_MS = 240;
const PULSE_INTERVAL_MIN_MS = 5_000;
const PULSE_INTERVAL_MAX_MS = 10_000;
const PULSE_DURATION_MS = 300;
const TICK_GOLD_HEX = "#eab308";
const FALLBACK_ACCENT_HEX = "#39ff14";

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function readCssNumberVar(root: HTMLElement, name: string): number | null {
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  if (!raw) {
    return null;
  }
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) ? num : null;
}

function readCssStringVar(root: HTMLElement, name: string): string | null {
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  return raw.length > 0 ? raw : null;
}

function parseHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.trim();
  const m6 = /^#([0-9a-f]{6})$/i.exec(s);
  if (m6) {
    const n = parseInt(m6[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const m3 = /^#([0-9a-f]{3})$/i.exec(s);
  if (m3) {
    const [a, b, c] = m3[1]!.split("");
    return {
      r: parseInt(a + a, 16),
      g: parseInt(b + b, 16),
      b: parseInt(c + c, 16)
    };
  }
  return null;
}

function rgbToCssRgba(rgb: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function resolveAccentRgb(root: HTMLElement, override: string | undefined): { r: number; g: number; b: number } {
  const candidate =
    (override?.trim() ? override.trim() : null) ??
    readCssStringVar(root, "--veil-accent") ??
    readCssStringVar(root, "--xf-tenant-accent") ??
    FALLBACK_ACCENT_HEX;
  return parseHexToRgb(candidate) ?? parseHexToRgb(FALLBACK_ACCENT_HEX)!;
}

function deriveOpacity(root: HTMLElement, override: number | undefined): number {
  const fromProp = typeof override === "number" ? override : null;
  const fromCss = readCssNumberVar(root, "--veil-opacity");
  return clamp(fromProp ?? fromCss ?? DEFAULT_OPACITY, 0, 0.6);
}

function deriveGridSpeed(root: HTMLElement, override: number | undefined): number {
  const fromProp = typeof override === "number" ? override : null;
  const fromCss = readCssNumberVar(root, "--veil-grid-speed");
  return clamp(fromProp ?? fromCss ?? DEFAULT_GRID_SPEED, 0.25, 3);
}

function deriveParticleTarget(root: HTMLElement, override: number | undefined, isCoarsePointer: boolean): number {
  const fromProp = typeof override === "number" ? override : null;
  const fromCss = readCssNumberVar(root, "--veil-particle-count");
  const desktopTarget = clamp(Math.round(fromProp ?? fromCss ?? DEFAULT_PARTICLE_COUNT), 8, 96);
  return isCoarsePointer ? Math.min(desktopTarget, 18) : desktopTarget;
}

function scheduleAfterLoad(cb: () => void): ScheduleHandle {
  let cancelled = false;
  let inner: ScheduleHandle | null = null;

  const runIdle = () => {
    if (cancelled) {
      return;
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(cb, { timeout: 1500 });
      inner = { cancel: () => w.cancelIdleCallback?.(id) };
      return;
    }
    const t = setTimeout(cb, 200);
    inner = { cancel: () => clearTimeout(t) };
  };

  if (document.readyState === "complete") {
    runIdle();
  } else {
    const onLoad = () => {
      window.removeEventListener("load", onLoad);
      runIdle();
    };
    window.addEventListener("load", onLoad, { once: true });
    inner = { cancel: () => window.removeEventListener("load", onLoad) };
  }

  return {
    cancel: () => {
      cancelled = true;
      inner?.cancel();
    }
  };
}

export function MarketVeilBackground({
  opacity,
  gridSpeed,
  particleCount,
  className,
  accent,
  skylineSrc,
  overlay,
  skylineFilter,
  skylineOpacity
}: MarketVeilBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      return;
    }

    let started = false;
    let cleanup: (() => void) | null = null;
    const handle = scheduleAfterLoad(() => {
      if (started) {
        return;
      }
      started = true;
      cleanup = startMarketVeilLoop(canvas, ctx, { opacity, gridSpeed, particleCount, accent });
    });

    return () => {
      handle.cancel();
      cleanup?.();
    };
  }, [opacity, gridSpeed, particleCount, accent]);

  const merged = ["market-veil-bg", className].filter(Boolean).join(" ");

  // `null` explicitly disables the layer; `undefined` falls back to the
  // built-in skyline so existing call-sites get the new visual for free.
  const resolvedSkyline = skylineSrc === null ? null : (skylineSrc ?? DEFAULT_SKYLINE_SRC);
  const resolvedOverlay = overlay === null ? null : (overlay ?? DEFAULT_OVERLAY_GRADIENT);
  const resolvedSkylineFilter = skylineFilter ?? DEFAULT_SKYLINE_FILTER;
  const resolvedSkylineOpacity = clamp(skylineOpacity ?? DEFAULT_SKYLINE_OPACITY, 0, 1);

  return (
    <div
      aria-hidden="true"
      className={merged}
      style={{
        position: "fixed",
        inset: 0,
        // `z-index: 0` (not negative) so the fixed wrapper paints ABOVE body's
        // opaque dark gradient (`atxfinance-brand-kit.css` body background).
        // Product chrome (`workspace-product-sticky-top`, `xchat-body`,
        // `app-footer`) all establish their own `z-index: 1` stacking contexts
        // in `xchat.css`, so they remain above the veil. With `-1` the entire
        // veil was hidden behind body's opaque bg on dark theme.
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: "#050505"
      }}
    >
      {resolvedSkyline ? (
        // Plain <img> on purpose: we need `fetchPriority="low"` so the skyline
        // never competes with the LCP candidate, plus a non-wrapped element to
        // sit cleanly inside the absolute-positioned layered stack. `next/image`
        // injects its own wrapper + sets eager fetch priority for visible images,
        // both of which break the perf contract we just measured.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          fetchPriority="low"
          loading="eager"
          src={resolvedSkyline}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 70%",
            // Subtle B&W watermark — see DEFAULT_SKYLINE_FILTER /
            // DEFAULT_SKYLINE_OPACITY for the rationale (WCAG AA against body
            // copy on `--xf-bg-900`, matches Q4 brand-quiet guidance).
            filter: resolvedSkylineFilter,
            opacity: resolvedSkylineOpacity,
            userSelect: "none"
          }}
        />
      ) : null}
      {resolvedOverlay ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: resolvedOverlay,
            pointerEvents: "none"
          }}
        />
      ) : null}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%"
        }}
      />
    </div>
  );
}

type StartOpts = Pick<MarketVeilBackgroundProps, "opacity" | "gridSpeed" | "particleCount" | "accent">;

function startMarketVeilLoop(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  opts: StartOpts
): () => void {
  const root = document.documentElement;
  const reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerMq = window.matchMedia("(pointer: coarse)");
  let reducedMotion = reducedMotionMq.matches;
  let coarsePointer = coarsePointerMq.matches;

  const onReducedMotionChange = () => {
    reducedMotion = reducedMotionMq.matches;
  };
  const onCoarseChange = () => {
    coarsePointer = coarsePointerMq.matches;
    target = deriveParticleTarget(root, opts.particleCount, coarsePointer);
    rebuildParticles();
  };
  reducedMotionMq.addEventListener("change", onReducedMotionChange);
  coarsePointerMq.addEventListener("change", onCoarseChange);

  let width = 0;
  let height = 0;
  let dpr = 1;

  const accent = resolveAccentRgb(root, opts.accent);
  const baseOpacity = deriveOpacity(root, opts.opacity);
  const gridSpeed = deriveGridSpeed(root, opts.gridSpeed);

  let target = deriveParticleTarget(root, opts.particleCount, coarsePointer);
  let particles: Particle[] = [];
  let edges: ConnectionEdge[] = [];

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildParticles();
  };

  const rebuildParticles = () => {
    particles = Array.from({ length: target }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      size: Math.random() * 1.4 + 0.7,
      baseAlpha: Math.random() * 0.4 + 0.45,
      noiseSeed: Math.random() * 1000,
      flashUntil: 0
    }));
    edges = computeNeighbourEdges(particles);
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });

  // Mouse parallax (desktop only — skipped on coarse pointers)
  let parallaxTx = 0;
  let parallaxTy = 0;
  let targetPx = 0;
  let targetPy = 0;
  const onMove = (e: MouseEvent) => {
    if (reducedMotion || coarsePointer || width < 1) {
      return;
    }
    targetPx = ((e.clientX / width) * 2 - 1) * PARALLAX_MAX_PX;
    targetPy = ((e.clientY / height) * 2 - 1) * PARALLAX_MAX_PX;
  };
  if (!coarsePointer) {
    window.addEventListener("mousemove", onMove, { passive: true });
  }

  // Visibility / focus pause — saves battery + avoids stale FPS-throttle decisions.
  let paused = document.visibilityState === "hidden";
  const onVisibility = () => {
    paused = document.visibilityState === "hidden";
    if (!paused && !reducedMotion) {
      lastFrameTime = performance.now();
      schedule();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // FPS auto-throttle: sample on each frame; if rolling fps < 45 reduce particles by ~25%.
  let frameSamples = 0;
  let frameAccumMs = 0;
  let lastFrameTime = performance.now();

  // Pulse / tick choreography
  let nextPulseAt = performance.now() + PULSE_INTERVAL_MIN_MS;
  let pulseUntil = 0;
  let nextTickAt = performance.now() + TICK_INTERVAL_MIN_MS;

  const scheduleNextPulse = (now: number) => {
    nextPulseAt = now + PULSE_INTERVAL_MIN_MS + Math.random() * (PULSE_INTERVAL_MAX_MS - PULSE_INTERVAL_MIN_MS);
  };
  const scheduleNextTick = (now: number) => {
    nextTickAt = now + TICK_INTERVAL_MIN_MS + Math.random() * (TICK_INTERVAL_MAX_MS - TICK_INTERVAL_MIN_MS);
  };

  const drawGrid = (timeSec: number) => {
    const breathPhase = (timeSec * gridSpeed) / GRID_BREATHING_SECONDS;
    // 0..1..0 sine envelope for the grid alpha (slow breathing).
    const breath = 0.5 + 0.5 * Math.sin(breathPhase * Math.PI * 2 - Math.PI / 2);
    // 0.85 → 1.40× of base — keeps the grid clearly visible at the breath
    // valley while letting it lift another ~60% at the crest. Calibrated
    // against the Grok Imagine reference where the lattice is always readable.
    const gridAlpha = baseOpacity * (0.85 + breath * 0.55);
    if (gridAlpha < 0.005) {
      return;
    }
    const cell = Math.max(48, Math.min(96, Math.floor(width / 14)));
    const offsetX = parallaxTx;
    const offsetY = parallaxTy;
    ctx.strokeStyle = rgbToCssRgba(accent, gridAlpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (offsetX % cell) - cell; x <= width; x += cell) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = (offsetY % cell) - cell; y <= height; y += cell) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  };

  const drawConnections = (now: number) => {
    if (edges.length === 0) {
      return;
    }
    const pulseActive = now < pulseUntil;
    // Lift base line alpha and pulse ceiling so the periodic "data exchange"
    // pulse reads clearly against the skyline.
    const lineAlpha = baseOpacity * (pulseActive ? 2.0 : 1.1);
    if (lineAlpha < 0.005) {
      return;
    }
    ctx.strokeStyle = rgbToCssRgba(accent, Math.min(0.6, lineAlpha));
    ctx.lineWidth = pulseActive ? 0.9 : 0.65;
    ctx.beginPath();
    for (const edge of edges) {
      const a = particles[edge.from];
      const b = particles[edge.to];
      if (!a || !b) {
        continue;
      }
      ctx.moveTo(a.x + parallaxTx, a.y + parallaxTy);
      ctx.lineTo(b.x + parallaxTx, b.y + parallaxTy);
    }
    ctx.stroke();
  };

  const drawParticles = (now: number, dtSec: number, timeSec: number) => {
    const tickRgb = parseHexToRgb(TICK_GOLD_HEX) ?? { r: 234, g: 179, b: 8 };
    for (const p of particles) {
      // Sine + random walk — cheap Perlin-ish drift (no math.noise lib dep).
      const driftX = Math.sin((timeSec + p.noiseSeed) * 0.21) * 0.18;
      const driftY = Math.cos((timeSec + p.noiseSeed) * 0.27) * 0.18;
      if (!reducedMotion) {
        p.x += (p.vx + driftX) * dtSec * 60;
        p.y += (p.vy + driftY) * dtSec * 60;
        if (p.x < -8) p.x = width + 8;
        if (p.x > width + 8) p.x = -8;
        if (p.y < -8) p.y = height + 8;
        if (p.y > height + 8) p.y = -8;
      }
      const alpha = baseOpacity * 4 * p.baseAlpha;
      const isFlashing = now < p.flashUntil;
      const fillRgb = isFlashing ? tickRgb : accent;
      const flashBoost = isFlashing ? 1.8 : 1;
      ctx.fillStyle = rgbToCssRgba(fillRgb, Math.min(0.9, alpha * flashBoost));
      ctx.beginPath();
      ctx.arc(p.x + parallaxTx, p.y + parallaxTy, p.size * (isFlashing ? 1.6 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const renderFrame = (now: number) => {
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    if (!reducedMotion) {
      parallaxTx += (targetPx - parallaxTx) * 0.06;
      parallaxTy += (targetPy - parallaxTy) * 0.06;
    }

    if (!reducedMotion && now >= nextPulseAt) {
      pulseUntil = now + PULSE_DURATION_MS;
      scheduleNextPulse(now);
    }

    if (!reducedMotion && now >= nextTickAt && particles.length > 0) {
      const idx = Math.floor(Math.random() * particles.length);
      const p = particles[idx];
      if (p) {
        p.flashUntil = now + TICK_FLASH_MS;
      }
      scheduleNextTick(now);
    }

    ctx.clearRect(0, 0, width, height);
    const timeSec = now / 1000;
    drawGrid(timeSec);
    drawConnections(now);
    drawParticles(now, dt, timeSec);

    // FPS auto-throttle (only when animating)
    if (!reducedMotion) {
      frameAccumMs += now - (now - dt * 1000);
      frameSamples += 1;
      if (frameSamples >= FPS_SAMPLE_FRAMES) {
        const avgFps = 1000 / Math.max(1, frameAccumMs / frameSamples);
        if (avgFps < FPS_THROTTLE_THRESHOLD && target > 8) {
          target = Math.max(8, Math.floor(target * 0.75));
          rebuildParticles();
        }
        frameSamples = 0;
        frameAccumMs = 0;
      }
    }
  };

  let animationFrame = 0;
  const schedule = () => {
    if (paused || reducedMotion) {
      // Reduced motion: paint exactly one static frame then idle.
      if (reducedMotion) {
        renderFrame(performance.now());
      }
      return;
    }
    animationFrame = requestAnimationFrame((t) => {
      renderFrame(t);
      schedule();
    });
  };

  // First paint (also handles the reduced-motion static frame).
  if (reducedMotion) {
    renderFrame(performance.now());
  } else {
    schedule();
  }

  return () => {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener("resize", resize);
    if (!coarsePointer) {
      window.removeEventListener("mousemove", onMove);
    }
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotionMq.removeEventListener("change", onReducedMotionChange);
    coarsePointerMq.removeEventListener("change", onCoarseChange);
  };
}

/**
 * Compute a sparse neighbour graph (max ~1.5 edges per node) so connection
 * lines feel organic without quadratic per-frame distance checks.
 */
function computeNeighbourEdges(particles: Particle[]): ConnectionEdge[] {
  const edges: ConnectionEdge[] = [];
  const len = particles.length;
  if (len < 2) {
    return edges;
  }
  // Pre-sort by x so we only scan a small window per particle (cheap O(n log n)).
  const indices = Array.from({ length: len }, (_, i) => i);
  indices.sort((a, b) => particles[a]!.x - particles[b]!.x);
  for (let i = 0; i < indices.length; i += 1) {
    const idxA = indices[i]!;
    const a = particles[idxA]!;
    for (let j = i + 1; j < indices.length && j < i + 5; j += 1) {
      const idxB = indices[j]!;
      const b = particles[idxB]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      // Cap visual reach so cross-screen lines don't appear when count is low.
      if (dx * dx + dy * dy < 220 * 220) {
        edges.push({ from: idxA, to: idxB });
      }
    }
  }
  return edges;
}
