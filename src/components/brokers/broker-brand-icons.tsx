import type { ReactNode, SVGProps } from "react";

/** Official / production-safe brand hex (inline SVG only — no theme tokens). */
export const BROKER_BRAND_COLORS = {
  fidelity: { primary: "#00A651", onPrimary: "#FFFFFF" },
  etrade: { primary: "#003366", onPrimary: "#FFFFFF", accent: "#5B9BD5" },
  forge: { primary: "#0B1220", ring: "#FF6B00", onPrimary: "#FFFFFF", accent: "#FF8C42" },
  hiive: { primary: "#00C9A7", onPrimary: "#FFFFFF", inner: "#0A3D35" },
  ibkr: { primary: "#E31837", onPrimary: "#FFFFFF" },
  merrill: { primary: "#012169", accent: "#FFC72C", onPrimary: "#FFFFFF" }
} as const;

export type BrokerBrandSlug = keyof typeof BROKER_BRAND_COLORS;

type MarkProps = {
  size: number;
  title?: string;
};

function BrandSvg({
  size,
  title,
  children,
  ...props
}: MarkProps & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

function FidelityMark({ size, title }: MarkProps) {
  const c = BROKER_BRAND_COLORS.fidelity;
  return (
    <BrandSvg size={size} title={title}>
      <circle cx="50" cy="50" r="48" fill={c.primary} />
      <path
        d="M50 20 L59.2 39.8 H79.8 L63.4 51.8 L69.2 71.6 L50 59.6 L30.8 71.6 L36.6 51.8 L20.2 39.8 H40.8 Z"
        fill={c.onPrimary}
      />
    </BrandSvg>
  );
}

function EtradeMark({ size, title }: MarkProps) {
  const c = BROKER_BRAND_COLORS.etrade;
  return (
    <BrandSvg size={size} title={title}>
      <defs>
        <filter id="xf-broker-etrade-glow" x="-8%" y="-8%" width="116%" height="116%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor={c.accent} floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r="48" fill={c.primary} filter="url(#xf-broker-etrade-glow)" />
      <circle cx="50" cy="50" r="44" fill="none" stroke={c.onPrimary} strokeOpacity="0.12" strokeWidth="1.5" />
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fill={c.onPrimary}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="46"
        fontWeight="700"
        letterSpacing="-0.06em"
      >
        E
      </text>
    </BrandSvg>
  );
}

function ForgeMark({ size, title }: MarkProps) {
  const c = BROKER_BRAND_COLORS.forge;
  return (
    <BrandSvg size={size} title={title}>
      <circle cx="50" cy="50" r="48" fill={c.primary} />
      <circle cx="50" cy="50" r="44" fill="none" stroke={c.ring} strokeOpacity="0.55" strokeWidth="2" />
      <path
        d="M34 38 L50 28 L66 38 V54 L50 72 L34 54 Z"
        fill="none"
        stroke={c.accent}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill={c.onPrimary}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="22"
        fontWeight="800"
        letterSpacing="-0.08em"
      >
        FG
      </text>
    </BrandSvg>
  );
}

function HiiveMark({ size, title }: MarkProps) {
  const c = BROKER_BRAND_COLORS.hiive;
  return (
    <BrandSvg size={size} title={title}>
      <circle cx="50" cy="50" r="48" fill={c.primary} />
      <path
        d="M50 24 L68 34 V66 L50 76 L32 66 V34 Z"
        fill={c.onPrimary}
        fillOpacity="0.95"
      />
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fill={c.inner}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="30"
        fontWeight="800"
      >
        H
      </text>
    </BrandSvg>
  );
}

function IbkrMark({ size, title }: MarkProps) {
  const c = BROKER_BRAND_COLORS.ibkr;
  return (
    <BrandSvg size={size} title={title}>
      <circle cx="50" cy="50" r="48" fill={c.primary} />
      <path
        d="M50 22 L74 34 V52 C74 66.5 50 80 50 80 C50 80 26 66.5 26 52 V34 Z"
        fill={c.onPrimary}
      />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill={c.primary}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="24"
        fontWeight="800"
        letterSpacing="-0.04em"
      >
        IB
      </text>
    </BrandSvg>
  );
}

function MerrillMark({ size, title }: MarkProps) {
  const c = BROKER_BRAND_COLORS.merrill;
  return (
    <BrandSvg size={size} title={title}>
      <circle cx="50" cy="50" r="48" fill={c.primary} />
      <text
        x="50"
        y="64"
        textAnchor="middle"
        fill={c.accent}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="44"
        fontWeight="700"
      >
        M
      </text>
    </BrandSvg>
  );
}

const MARK_RENDERERS: Record<BrokerBrandSlug, (props: MarkProps) => ReactNode> = {
  fidelity: FidelityMark,
  etrade: EtradeMark,
  forge: ForgeMark,
  hiive: HiiveMark,
  ibkr: IbkrMark,
  merrill: MerrillMark
};

export function renderBrokerBrandMark(
  broker: BrokerBrandSlug,
  options: { size?: number; title?: string } = {}
): ReactNode {
  const size = options.size ?? 40;
  return MARK_RENDERERS[broker]({ size, title: options.title });
}
