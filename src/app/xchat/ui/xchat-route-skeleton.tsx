/**
 * Premium route skeleton: typing indicator + faux transcript lines.
 * Used by `loading.tsx` and Suspense fallback for `/xchat` approved shell.
 */
export function XchatRouteSkeleton() {
  return (
    <div className="xchat-route-skeleton xf-noise-overlay" aria-busy="true" aria-label="Loading xChat">
      <div className="xchat-route-skeleton__header">
        <span className="xchat-route-skeleton__pulse xchat-route-skeleton__pulse--title" />
        <span className="xchat-route-skeleton__pulse xchat-route-skeleton__pulse--sub" />
      </div>
      <div className="xchat-route-skeleton__thread">
        <div className="xchat-route-skeleton__typing" aria-hidden>
          <span className="xchat-typing-dot" />
          <span className="xchat-typing-dot" />
          <span className="xchat-typing-dot" />
        </div>
        <div className="xchat-route-skeleton__lines">
          <span className="xchat-route-skeleton__line xchat-route-skeleton__line--user" />
          <span className="xchat-route-skeleton__line xchat-route-skeleton__line--ai xchat-route-skeleton__line--long" />
          <span className="xchat-route-skeleton__line xchat-route-skeleton__line--user xchat-route-skeleton__line--short" />
          <span className="xchat-route-skeleton__line xchat-route-skeleton__line--ai" />
        </div>
      </div>
      <div className="xchat-route-skeleton__composer">
        <span className="xchat-route-skeleton__pulse xchat-route-skeleton__pulse--field" />
      </div>
    </div>
  );
}
