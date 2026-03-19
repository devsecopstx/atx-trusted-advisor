export function XchatGuestPanel() {
  return (
    <div className="xchat-main">
      <div className="xchat-persona-bar">
        <span className="status-badge status-ready">xChat</span>
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          Guest preview (stealth mode)
        </span>
      </div>

      <div className="xchat-messages">
        <div className="xchat-msg xchat-msg-ai">
          <small style={{ color: "var(--xf-text-400)", display: "block", marginBottom: "0.3rem" }}>
            xChat
          </small>
          <span style={{ whiteSpace: "pre-wrap" }}>
            Welcome to atxFinance xChat. Sign in with X to continue this conversation.
          </span>
        </div>
      </div>

      <form className="xchat-input-bar">
        <input
          aria-label="xchat guest prompt"
          placeholder="Hit me – portfolio questions, optimizations, whatever"
          readOnly
          value=""
        />
        <a className="cta cta-primary" href="/login?next=%2Fxchat">
          Sign in with X
        </a>
      </form>
    </div>
  );
}
