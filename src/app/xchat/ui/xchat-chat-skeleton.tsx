"use client";

export type XchatChatSkeletonVariant = "thread" | "composer";

type Props = {
  variant?: XchatChatSkeletonVariant;
};

/** Fast shell while lazy thread / composer chunks load (LCP / INP friendly). */
export function XchatChatSkeleton({ variant = "thread" }: Props) {
  if (variant === "composer") {
    return (
      <div className="xchat-composer-wrap" aria-hidden>
        <div className="xchat-composer xchat-composer--skeleton">
          <div className="xchat-composer__row xchat-composer__row--input">
            <div
              className="xchat-composer-skeleton-field rounded-md"
              style={{
                minHeight: "2.75rem",
                width: "100%",
                border: "1px solid color-mix(in srgb, var(--xf-text-100) 12%, transparent)",
                background: "color-mix(in srgb, var(--xf-text-100) 6%, transparent)"
              }}
            />
          </div>
          <div className="xchat-composer__row xchat-composer__row--actions">
            <div
              className="rounded-md"
              style={{
                height: "2.25rem",
                width: "8rem",
                background: "color-mix(in srgb, var(--xf-text-100) 8%, transparent)"
              }}
            />
            <div
              className="rounded-md"
              style={{
                height: "2.25rem",
                width: "6rem",
                background: "color-mix(in srgb, var(--xf-gain-green) 18%, transparent)"
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="xchat-thread-area" aria-busy="true" aria-label="Loading conversation">
      <div className="xchat-messages xchat-messages--skeleton">
        <div
          aria-hidden
          className="xchat-await"
          role="status"
          style={{ border: "none", background: "transparent", paddingTop: "0.5rem" }}
        >
          <div className="xchat-await__row">
            <div className="xchat-typing">
              <span className="xchat-typing-dot" />
              <span className="xchat-typing-dot" />
              <span className="xchat-typing-dot" />
            </div>
            <div className="xchat-await__copy">
              <span className="xchat-await__title">Loading thread…</span>
              <span className="xchat-await__hint">Recent messages will appear here.</span>
            </div>
          </div>
          <div aria-hidden className="xchat-await__skeleton">
            <span className="xchat-await__sk-line xchat-await__sk-line--long" />
            <span className="xchat-await__sk-line xchat-await__sk-line--med" />
            <span className="xchat-await__sk-line xchat-await__sk-line--short" />
          </div>
        </div>
      </div>
    </div>
  );
}
