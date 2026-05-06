import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

type EducationalDisclaimerBannerProps = {
  className?: string;
};

export function EducationalDisclaimerBanner({ className }: EducationalDisclaimerBannerProps) {
  const merged = ["xf-educational-disclaimer-banner", className].filter(Boolean).join(" ");
  return (
    <div className={merged} role="note">
      {EDUCATIONAL_ONLY_SHORT}
    </div>
  );
}

