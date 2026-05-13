import { GoogleGIcon, XLogoIcon } from "@/app/ui/oauth-provider-icons";

type LoginOAuthSectionProps = {
  googleLoginHref: string | null;
  xOAuthLoginHref: string;
};

/**
 * Secondary OAuth options below the primary email + password form.
 * Buttons are intentionally smaller (less padding, less weight) so
 * email + password remains the dominant call-to-action on `/login`.
 */
export function LoginOAuthSection({ googleLoginHref, xOAuthLoginHref }: LoginOAuthSectionProps) {
  return (
    <div className="login-oauth-section login-oauth-section--secondary flex w-full flex-col gap-2.5">
      {googleLoginHref ? (
        <a
          className="cta cta-secondary login-oauth-secondary-btn login-google-btn w-full justify-center py-2.5 text-sm font-medium"
          href={googleLoginHref}
        >
          <GoogleGIcon size={18} />
          Continue with Google
        </a>
      ) : (
        <button
          className="cta cta-secondary login-oauth-section__google-disabled w-full cursor-not-allowed justify-center py-2.5 text-sm opacity-55"
          disabled
          type="button"
        >
          <GoogleGIcon size={18} />
          Google unavailable
        </button>
      )}
      <a
        className="cta cta-secondary login-oauth-secondary-btn login-oauth-x w-full justify-center py-2.5 text-sm font-medium"
        href={xOAuthLoginHref}
      >
        <XLogoIcon size={18} />
        Continue with X
      </a>
    </div>
  );
}

export function LoginOAuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="login-oauth-divider flex items-center gap-3 py-1" role="presentation">
      <span className="h-px min-h-px flex-1 bg-[color-mix(in_srgb,var(--xf-xchat-rail-border)_85%,transparent)]" />
      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-[var(--xf-text-muted)]">
        {label}
      </span>
      <span className="h-px min-h-px flex-1 bg-[color-mix(in_srgb,var(--xf-xchat-rail-border)_85%,transparent)]" />
    </div>
  );
}
