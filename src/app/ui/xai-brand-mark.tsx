type XaiLogoIconProps = {
  className?: string;
};

/** Monochrome xAI mark — `public/branding/xai-logo.svg` (source: Wikimedia Commons, File:XAI-Logo.svg). Pair with `invert` on dark backgrounds. */
export function XaiLogoIcon({ className }: XaiLogoIconProps) {
  return (
    <img
      src="/branding/xai-logo.svg"
      alt=""
      width={466}
      height={517}
      aria-hidden
      className={className}
    />
  );
}

type PoweredByXaiProps = {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
};

/** Visible “Powered by xAI” line with logo mark. */
export function PoweredByXai({
  className,
  logoClassName = "h-5 w-auto sm:h-6",
  textClassName = "text-xs font-semibold uppercase tracking-[0.16em] text-[var(--xf-text-300)] sm:text-sm"
}: PoweredByXaiProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <XaiLogoIcon className={`shrink-0 invert opacity-95 ${logoClassName}`} />
      <span className={textClassName}>Powered by xAI</span>
    </span>
  );
}
