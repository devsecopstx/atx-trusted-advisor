"use client";

import { useEffect, useRef } from "react";

/**
 * `MarketVeilBackground` — ambient market-data veil for app_user product shells.
 *
 * **Visual:** subtle teal grid (slow breathing cycle), drifting accent particles
 * with occasional "tick" highlights, and faint micro-connection lines between
 * neighbour particles. Sits at `z-index: -1` behind product chrome; mostly
 * transparent so any tenant background image (e.g. Austin skyline) shows
 * through. Designed to evoke a live-data veil without distracting traders.
 *
 * **Performance contract** (must hold — see `atx-docs/design-system/current-state-features.md`):
 * - Pure Canvas2D + `requestAnimationFrame`; zero new runtime deps.
 * - Setup + animation loop start are gated behind `window.load` + an idle hop
 *   so they never enter Lighthouse’s FCP → TTI window (TBT contract). This
 *   mirrors the same defer pattern that just brought `/xchat` back to perf 1.00
 *   for `StarfieldBackground`.
 * - Auto-throttles particle count when measured FPS drops below 45.
 * - Pauses on `document.visibilitychange === "hidden"` and on
 *   `prefers-reduced-motion: reduce` (no RAF, single static frame instead).
 * - `aria-hidden="true"` + `pointer-events: none` (purely decorative).
 *
 * **Tunables** (props *or* CSS custom properties — props win):
 * - `--veil-opacity` (default `0.09`) — global alpha multiplier.
 * - `--veil-grid-speed` (default `1.0`) — multiplier on the 52 s breathing cycle.
 * - `--veil-particle-count` (default `28`) — desktop target; mobile and
 *   reduced-motion paths derive from this.
 *
 * **Mouse parallax** is desktop-only (skipped on coarse pointers) and capped
 * at ±5 px so it never crosses into a perceptible camera move.
 *
 * Mount once per route shell. Keep at `<MarketVeilBackground />` defaults
 * unless the tenant explicitly tunes the veil via CSS variables on `:root`
 * (preferred) or via props on this component.
 */

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

const DEFAULT_OPACITY = 0.09;
const DEFAULT_GRID_SPEED = 1.0;
const DEFAULT_PARTICLE_COUNT = 28;
const PARALLAX_MAX_PX = 5;
const FPS_THROTTLE_THRESHOLD = 45;
const FPS_SAMPLE_FRAMES = 60;
const GRID_BREATHING_SECONDS = 52;
const TICK_INTERVAL_MIN_MS = 4_000;
const TICK_INTERVAL_MAX_MS = 7_000;
const TICK_FLASH_MS = 220;
const PULSE_INTERVAL_MIN_MS = 8_000;
const PULSE_INTERVAL_MAX_MS = 14_000;
const PULSE_DURATION_MS = 180;
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
  accent
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

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={merged}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        width: "100%",
        height: "100%"
      }}
    />
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
    const gridAlpha = baseOpacity * (0.55 + breath * 0.45);
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
    const lineAlpha = baseOpacity * (pulseActive ? 1.6 : 0.85);
    if (lineAlpha < 0.005) {
      return;
    }
    ctx.strokeStyle = rgbToCssRgba(accent, lineAlpha);
    ctx.lineWidth = 0.6;
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
