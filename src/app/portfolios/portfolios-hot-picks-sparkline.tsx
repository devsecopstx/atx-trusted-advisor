"use client";

type Props = {
  maxGainPercent: number;
  maxLossPercent: number;
  className?: string;
};

/** Compact expiry-style payoff hint (no Apex dep on hot-picks cards). */
export function PortfoliosHotPicksSparkline({ maxGainPercent, maxLossPercent, className = "" }: Props) {
  const gain = Number.isFinite(maxGainPercent) ? maxGainPercent : 0;
  const loss = Number.isFinite(maxLossPercent) ? maxLossPercent : -100;
  const pMax = Math.max(gain, 8);
  const pMin = Math.min(loss, -8);
  const pad = Math.max(Math.abs(pMin), Math.abs(pMax)) * 0.15;
  const yTop = pMax + pad;
  const yBot = pMin - pad;
  const toY = (v: number) => 6 + (1 - (v - yBot) / (yTop - yBot)) * 40;
  const y0 = toY(0);
  const yGain = toY(gain);
  const yLoss = toY(loss);
  const lineD = `M 8 ${y0.toFixed(1)} L 28 ${yGain.toFixed(1)} L 52 ${y0.toFixed(1)} L 76 ${yLoss.toFixed(1)} L 92 ${y0.toFixed(1)}`;

  return (
    <svg
      aria-hidden
      className={`portfolios-hot-picks-sparkline ${className}`.trim()}
      viewBox="0 0 100 52"
      preserveAspectRatio="none"
    >
      <line
        stroke="color-mix(in srgb, var(--xf-text-300) 55%, transparent)"
        strokeDasharray="2 3"
        x1="4"
        x2="96"
        y1={y0}
        y2={y0}
      />
      <path
        d={lineD}
        fill="none"
        stroke="var(--xf-tenant-accent, var(--xf-gain-green))"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
