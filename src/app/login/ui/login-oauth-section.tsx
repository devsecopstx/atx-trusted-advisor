import { GoogleGIcon, XLogoIcon } from "@/app/ui/oauth-provider-icons";

type LoginOAuthSectionProps = {
  googleLoginHref: string | null;
  xOAuthLoginHref: string;
};

export function LoginOAuthSection({ googleLoginHref, xOAuthLoginHref }: LoginOAuthSectionProps) {
  return (
    <div className="login-oauth-section flex w-full flex-col gap-3">
      {googleLoginHref ? (
        <a
          className="cta cta-oauth-google login-google-btn w-full justify-center py-3.5 text-base"
          href={googleLoginHref}
        >
          <GoogleGIcon size={22} />
          Continue with Google
        </a>
      ) : (
        <button
          className="cta cta-secondary login-oauth-section__google-disabled w-full cursor-not-allowed justify-center py-3.5 text-base opacity-55"
          disabled
          type="button"
        >
          <GoogleGIcon size={22} />
          Google unavailable
        </button>
      )}
      <a
        className="cta cta-secondary login-oauth-x w-full justify-center py-3.5 text-base"
        href={xOAuthLoginHref}
      >
        <XLogoIcon size={22} />
        Continue with X
      </a>
    </div>
  );
}

export function LoginOAuthDivider() {
  return (
    <div className="login-oauth-divider flex items-center gap-3 py-1" role="presentation">
      <span className="h-px min-h-px flex-1 bg-[color-mix(in_srgb,var(--xf-xchat-rail-border)_85%,transparent)]" />
      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-[var(--xf-text-muted)]">
        or
      </span>
      <span className="h-px min-h-px flex-1 bg-[color-mix(in_srgb,var(--xf-xchat-rail-border)_85%,transparent)]" />
    </div>
  );
}
