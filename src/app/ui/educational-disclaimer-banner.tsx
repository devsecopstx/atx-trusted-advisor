import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

type EducationalDisclaimerBannerProps = {
  className?: string;
};

export function EducationalDisclaimerBanner({ className }: EducationalDisclaimerBannerProps) {
  return (
    <div
      className={className}
      role="note"
      style={{
        margin: "0.5rem 0 0.25rem",
        padding: "0.5rem 0.75rem",
        borderRadius: 8,
        border: "1px solid var(--xf-border-subtle)",
        background: "var(--xf-surface-800)",
        color: "var(--xf-text-300)",
        fontSize: "0.72rem",
        lineHeight: 1.35
      }}
    >
      {EDUCATIONAL_ONLY_SHORT}
    </div>
  );
}

