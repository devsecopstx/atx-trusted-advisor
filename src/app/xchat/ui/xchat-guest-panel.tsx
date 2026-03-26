type XchatGuestPanelProps = {
  userEmail?: string;
  pendingApproval?: boolean;
};

const DEFAULT_SIGNIN_HREF = "/api/auth/x/login?next=%2Fxchat";

export function XchatGuestPanel({ userEmail, pendingApproval = false }: XchatGuestPanelProps) {
  const formspreeEndpoint = (process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT ?? "").trim();
  const hasFormspree = /^https?:\/\//i.test(formspreeEndpoint);

  return (
    <div className="xchat-main">
      <div className="xchat-persona-bar">
        <span className="status-badge status-ready">xChat</span>
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          Invite-only access
        </span>
      </div>

      <div className="xchat-messages">
        <div className="xchat-msg xchat-msg-ai">
          <small style={{ color: "var(--xf-text-400)", display: "block", marginBottom: "0.3rem" }}>
            xChat
          </small>
          <span style={{ whiteSpace: "pre-wrap" }}>
            {pendingApproval
              ? `Your account${userEmail ? ` (${userEmail})` : ""} is signed in but not approved yet. Request access and we will review it.`
              : "Welcome to atx Trusted Advisor xChat. This is an invite-only app. Sign up to request access."}
          </span>
        </div>
      </div>

      <section className="xchat-guest-actions">
        <h2 className="xchat-guest-actions__title">Sign up</h2>
        <p className="xchat-guest-actions__hint">Request access with your email.</p>
        {hasFormspree ? (
          <form action={formspreeEndpoint} className="xchat-guest-signup-form" method="POST">
            <input type="hidden" name="_subject" value="xFinance xChat access request" />
            <input
              aria-label="Email for access request"
              defaultValue={userEmail ?? ""}
              name="email"
              required
              type="email"
              className="xchat-guest-signup-form__email"
              placeholder="you@company.com"
            />
            <button className="cta cta-primary xchat-guest-signup-form__submit" type="submit">
              Sign up
            </button>
          </form>
        ) : (
          <a className="cta cta-primary xchat-guest-signup-form__submit" href="mailto:access@atx.finance">
            Sign up
          </a>
        )}
        <p className="xchat-guest-actions__signin">
          Already invited?{" "}
          <a className="xchat-guest-actions__signin-link" href={DEFAULT_SIGNIN_HREF}>
            Sign in
          </a>
        </p>
      </section>
    </div>
  );
}
