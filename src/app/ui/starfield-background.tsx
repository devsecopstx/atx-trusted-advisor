"use client";

import { useEffect, useRef } from "react";

import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";

type Star = {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
};

type NebulaLayer = {
  x: number;
  y: number;
  radius: number;
  hue: number;
  opacity: number;
  drift: number;
};

type ShootingStarState = {
  x: number;
  y: number;
  len: number;
  speed: number;
  opacity: number;
};

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
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

function rgbToHue(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d < 1e-6) {
    return 0;
  }
  let h = 0;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }
  return (h * 360) % 360;
}

function resolveAccentHue(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) {
    return 270;
  }
  return rgbToHue(rgb.r, rgb.g, rgb.b);
}

function readCssHexVar(el: HTMLElement, name: string): string | null {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  if (!v.startsWith("#")) {
    return null;
  }
  try {
    return normalizeXfAccentColor(v);
  } catch {
    return null;
  }
}

function resolveAccentHex(root: HTMLElement, propAccent: string | undefined): string {
  if (propAccent?.trim()) {
    try {
      return normalizeXfAccentColor(propAccent);
    } catch {
      /* fall through */
    }
  }
  return (
    readCssHexVar(root, "--xf-tenant-accent") ??
    readCssHexVar(root, "--xf-xoptions-accent") ??
    DEFAULT_TENANT_ACCENT_HEX
  );
}

export type StarfieldBackgroundProps = {
  /** Optional; when omitted, uses `--xf-tenant-accent` / `--xf-xoptions-accent` on `:root`. */
  tenantAccent?: string;
  className?: string;
};

export function StarfieldBackground({ tenantAccent, className }: StarfieldBackgroundProps) {
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

    const root = document.documentElement;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      reducedMotion = mq.matches;
    };
    mq.addEventListener("change", onMq);

    let width = 0;
    let height = 0;
    let dpr = 1;

    let stars: Star[] = [];
    let nebulae: NebulaLayer[] = [];

    let accentHue = resolveAccentHue(resolveAccentHex(root, tenantAccent));

    const rebuildScene = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      accentHue = resolveAccentHue(resolveAccentHex(root, tenantAccent));

      const numStars = Math.floor(Math.min(width * 0.18, 320));
      stars = Array.from({ length: numStars }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.4 + 0.5,
        opacity: Math.random() * 0.85 + 0.25,
        speed: Math.random() * 0.018 + 0.006
      }));

      nebulae = [
        {
          x: width * 0.3,
          y: height * 0.25,
          radius: width * 0.62,
          hue: 270,
          opacity: 0.16,
          drift: 0.06
        },
        {
          x: width * 0.78,
          y: height * 0.62,
          radius: width * 0.52,
          hue: 310,
          opacity: 0.12,
          drift: -0.045
        },
        {
          x: width * 0.12,
          y: height * 0.82,
          radius: width * 0.42,
          hue: 198,
          opacity: 0.095,
          drift: 0.035
        },
        {
          x: width * 0.58,
          y: height * 0.18,
          radius: width * 0.48,
          hue: 248,
          opacity: 0.075,
          drift: -0.055
        }
      ];
    };

    rebuildScene();
    window.addEventListener("resize", rebuildScene);

    let time = 0;
    let shootingStar: ShootingStarState | null = null;
    let animationFrame = 0;

    let parallaxTx = 0;
    let parallaxTy = 0;
    let targetPx = 0;
    let targetPy = 0;

    const onMove = (e: MouseEvent) => {
      if (reducedMotion || width < 1) {
        return;
      }
      targetPx = (e.clientX / width - 0.5) * width * 0.006;
      targetPy = (e.clientY / height - 0.5) * height * 0.006;
    };
    window.addEventListener("mousemove", onMove);

    const animate = () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);

      if (!reducedMotion) {
        parallaxTx += (targetPx - parallaxTx) * 0.045;
        parallaxTy += (targetPy - parallaxTy) * 0.045;
      }

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      nebulae.forEach((neb, i) => {
        const breathe = reducedMotion ? 0 : Math.sin(time * 0.008 + i) * 0.035;
        const pulse = Math.max(0.04, neb.opacity + breathe);
        const px = parallaxTx * (0.35 + i * 0.12);
        const py = parallaxTy * (0.28 + i * 0.1);

        const cx =
          neb.x +
          px +
          (reducedMotion ? 0 : Math.sin(time * 0.003) * 22);
        const cy =
          neb.y +
          py +
          (reducedMotion ? 0 : Math.cos(time * 0.0025) * 16);

        const gradient = ctx.createRadialGradient(
          cx,
          cy,
          neb.radius * 0.18,
          cx + (reducedMotion ? 0 : Math.cos(time * 0.0015) * 36),
          cy + (reducedMotion ? 0 : Math.sin(time * 0.002) * 30),
          neb.radius * 1.08
        );

        const hueShift = reducedMotion ? 0 : Math.sin(time * 0.004 + i * 0.7) * 7;
        const tenantBlend = i === 0 ? 0.42 : i === 3 ? 0.22 : 0;
        const baseHue = (neb.hue * (1 - tenantBlend) + accentHue * tenantBlend + hueShift + 720) % 360;

        gradient.addColorStop(0, `hsla(${baseHue}, 82%, 66%, ${pulse * 0.85})`);
        gradient.addColorStop(0.55, `hsla(${(baseHue + 16) % 360}, 68%, 46%, ${pulse * 0.32})`);
        gradient.addColorStop(1, `hsla(${(baseHue + 32) % 360}, 58%, 18%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          neb.radius,
          neb.radius * 0.64,
          reducedMotion ? i * 0.35 : time * 0.00075 + i * 0.25,
          0,
          Math.PI * 2
        );
        ctx.fill();

        if (!reducedMotion) {
          neb.x += neb.drift;
          if (neb.x < -neb.radius * 0.55) {
            neb.x = width + neb.radius * 0.55;
          }
          if (neb.x > width + neb.radius * 0.55) {
            neb.x = -neb.radius * 0.55;
          }
        }
      });

      ctx.restore();

      ctx.globalCompositeOperation = "source-over";

      stars.forEach((star) => {
        const twinkle = reducedMotion
          ? 0.82
          : Math.sin(time * star.speed * 4.2) * 0.28 + 0.78;
        const a = Math.min(1, star.opacity * twinkle);
        ctx.fillStyle = `rgba(236, 242, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        if (!reducedMotion) {
          star.x += star.speed * 0.22;
          if (star.x > width) {
            star.x = 0;
          }
        }
      });

      if (!reducedMotion && !shootingStar && Math.random() < 0.0065) {
        shootingStar = {
          x: Math.random() * width * 0.72,
          y: Math.random() * height * 0.42,
          len: Math.random() * 105 + 62,
          speed: Math.random() * 19 + 15,
          opacity: 0.92
        };
      }

      if (shootingStar && !reducedMotion) {
        const s = shootingStar;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.len, s.y + s.len * 0.55);
        grad.addColorStop(0, `rgba(228, 240, 255, ${s.opacity})`);
        grad.addColorStop(1, "rgba(170, 210, 255, 0)");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.8;
        ctx.lineCap = "round";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(196, 224, 255, 0.55)";

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y + s.len * 0.58);
        ctx.stroke();

        ctx.shadowBlur = 0;

        s.x += s.speed;
        s.y += s.speed * 0.56;
        s.opacity -= 0.041;

        if (s.opacity <= 0) {
          shootingStar = null;
        }
      } else if (reducedMotion) {
        shootingStar = null;
      }

      time += reducedMotion ? 0.025 : 1;
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", rebuildScene);
      mq.removeEventListener("change", onMq);
      window.removeEventListener("mousemove", onMove);
    };
  }, [tenantAccent]);

  const mergedClass = ["xchat-starfield-bg", className].filter(Boolean).join(" ");

  return <canvas ref={canvasRef} aria-hidden className={mergedClass} />;
}
