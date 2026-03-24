type AtxFinanceMarkProps = {
  size: number;
  className?: string;
};

/** Logo mark: "aTx" in gain-green, used in logo lockups and xChat header. */
export function AtxFinanceMark({ size, className }: AtxFinanceMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={`xf-logo-mark${className ? ` ${className}` : ""}`}
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <text
        fill="var(--xf-gain-green)"
        fontFamily="var(--font-inter, Inter, system-ui, sans-serif)"
        fontSize="18"
        fontWeight="700"
        letterSpacing="-0.04em"
        x="4"
        y="22"
      >
        aTx
      </text>
    </svg>
  );
}

/** Lightning bolt in lightning-yellow — sits between gain-green aTx and the Trusted Advisor wordmark. */
export function LightningBolt({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      className="xf-logo-lightning"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        fill="var(--xf-lightning-yellow)"
      />
    </svg>
  );
}

type AtxFinanceLogoProps = {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  className?: string;
};

export function AtxFinanceLogo({
  size = "md",
  showSubtitle = false,
  className
}: AtxFinanceLogoProps) {
  const markSize = size === "sm" ? 24 : size === "md" ? 32 : 44;
  const titleClass = `xf-logo-text xf-logo-text--${size}`;

  const boltSize = size === "sm" ? 18 : size === "md" ? 22 : 28;
  return (
    <div className={`xf-logo-lockup-inline${className ? ` ${className}` : ""}`}>
      <div className="xf-logo-row">
        <AtxFinanceMark size={markSize} />
        <LightningBolt size={boltSize} />
        <span className={`${titleClass} xf-logo-title-phrase`}>
          <span className="xf-logo-title-trusted">Trusted</span>{" "}
          <span className="xf-logo-title-advisor">Advisor</span>
        </span>
      </div>
      {showSubtitle ? (
        <p className="xf-logo-powered">
          <span className="xf-powered-by-muted">Powered by </span>
          <span className="xf-powered-by-brand">xAI</span>
        </p>
      ) : null}
    </div>
  );
}
