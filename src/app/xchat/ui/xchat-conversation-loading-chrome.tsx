"use client";

/** Shown while `next/dynamic` loads `XchatConversation` (ssr: false). */
export function XchatConversationLoadingChrome() {
  return (
    <div className="xchat-loading-mount" aria-busy="true" aria-label="Loading chat">
      <header className="xchat-welcome-header xchat-loading-mount__header">
        <div className="xchat-route-skeleton__pulse xchat-route-skeleton__pulse--title" />
        <div className="xchat-route-skeleton__pulse xchat-route-skeleton__pulse--sub" />
      </header>
      <div className="xchat-thread-area">
        <div className="xchat-messages xchat-loading-mount__messages">
          <div className="xchat-await xchat-loading-mount__await" role="status">
            <div className="xchat-await__row">
              <div className="xchat-typing" aria-hidden>
                <span className="xchat-typing-dot" />
                <span className="xchat-typing-dot" />
                <span className="xchat-typing-dot" />
              </div>
              <div className="xchat-await__copy">
                <span className="xchat-await__title">Loading workspace</span>
                <span className="xchat-await__hint">Composer and thread will appear in a moment.</span>
              </div>
            </div>
            <div aria-hidden className="xchat-await__skeleton">
              <div className="xchat-await__sk-track xchat-await__sk-track--long">
                <span className="xchat-await__sk-line" />
              </div>
              <div className="xchat-await__sk-track xchat-await__sk-track--med">
                <span className="xchat-await__sk-line" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="xchat-composer-wrap xchat-loading-mount__composer">
        <div className="xchat-route-skeleton__pulse xchat-route-skeleton__pulse--field" />
      </div>
    </div>
  );
}
