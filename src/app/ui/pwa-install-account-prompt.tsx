"use client";

import { usePwaInstallPrompt } from "@/app/ui/use-pwa-install-prompt";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

export function PwaInstallAccountPrompt() {
  const {
    dismissPrompt,
    installLabel,
    isDismissed,
    isInstalled,
    isNativeShell,
    openInstallPrompt,
    promptBusy,
    promptSupported,
    setShowIosInstructions,
    showIosInstructions,
    showNudge
  } = usePwaInstallPrompt();

  if (isNativeShell) {
    return null;
  }

  return (
    <div className="app-user-pwa-install">
      <XfHoverHint hint="Free - Instant - No App Store required">
        <button
          className="app-user-rail-sublink app-user-pwa-install__trigger"
          disabled={promptBusy || isInstalled}
          type="button"
          onClick={() => void openInstallPrompt()}
        >
          {isInstalled ? "App installed" : installLabel}
        </button>
      </XfHoverHint>
      {showNudge && !isDismissed && !isInstalled ? (
        <div className="app-user-pwa-install__nudge" role="status">
          <p className="app-user-pwa-install__nudge-title">{installLabel}</p>
          <p className="app-user-pwa-install__nudge-copy">Free - Instant - No App Store required</p>
          <div className="app-user-pwa-install__nudge-actions">
            <button
              className="app-user-rail-account-panel__btn app-user-pwa-install__btn"
              disabled={promptBusy}
              type="button"
              onClick={() => void openInstallPrompt()}
            >
              {promptBusy ? "Opening..." : installLabel}
            </button>
            <button
              className="app-user-rail-account-panel__btn app-user-pwa-install__btn app-user-pwa-install__btn--muted"
              type="button"
              onClick={dismissPrompt}
            >
              Maybe later
            </button>
          </div>
          {!promptSupported ? (
            <p className="app-user-pwa-install__nudge-copy app-user-pwa-install__nudge-copy--muted">
              Install prompt is not available in this browser.
            </p>
          ) : null}
        </div>
      ) : null}

      {showIosInstructions ? (
        <div
          aria-modal="true"
          className="xchat-feedback-backdrop"
          role="dialog"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowIosInstructions(false);
            }
          }}
        >
          <div className="xchat-feedback-dialog">
            <h2 className="xchat-feedback-title">Add to Home Screen</h2>
            <p className="xchat-feedback-hint">
              On Safari iPhone/iPad: tap Share, then choose Add to Home Screen, and tap Add.
            </p>
            <ol className="app-user-pwa-install__ios-steps">
              <li>Open this app in Safari.</li>
              <li>Tap the Share button in the browser toolbar.</li>
              <li>Select Add to Home Screen.</li>
              <li>Tap Add to finish.</li>
            </ol>
            <div className="xchat-feedback-actions">
              <button
                className="cta cta-secondary"
                type="button"
                onClick={() => setShowIosInstructions(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
