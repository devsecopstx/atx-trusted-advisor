type XFinanceLogoProps = {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  className?: string;
};

export function XFinanceLogo({
  size = "md",
  showSubtitle = false,
  className
}: XFinanceLogoProps) {
  const markSize = size === "sm" ? 24 : size === "md" ? 32 : 44;
  const titleClass = `xf-logo-text xf-logo-text--${size}`;

  return (
    <div className={`xf-logo-lockup-inline${className ? ` ${className}` : ""}`}>
      <div className="xf-logo-row">
        <svg
          aria-hidden="true"
          className="xf-logo-mark"
          fill="none"
          height={markSize}
          viewBox="0 0 32 32"
          width={markSize}
        >
          <rect
            fill="var(--xf-bg-900)"
            height="32"
            rx="8"
            width="32"
          />
          <path
            d="M9.5 8.5L16 16.5M16 16.5L22.5 24.5M16 16.5L22.5 8.5M16 16.5L9.5 24.5"
            stroke="var(--xf-text-100)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
        </svg>
        <span className={titleClass}>
          <span className="xf-logo-x-letter">x</span>Finance
        </span>
      </div>
      {showSubtitle ? (
        <p className="xf-logo-powered">Powered by xAI</p>
      ) : null}
    </div>
  );
}
