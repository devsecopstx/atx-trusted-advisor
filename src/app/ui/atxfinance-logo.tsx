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
      viewBox="0 0 52 24"
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

  return (
    <div className={`xf-logo-lockup-inline${className ? ` ${className}` : ""}`}>
      <div className="xf-logo-row">
        <AtxFinanceMark size={markSize} />
        <span className={titleClass}>xFinance</span>
      </div>
      {showSubtitle ? (
        <p className="xf-logo-powered">Powered by xAI</p>
      ) : null}
    </div>
  );
}
