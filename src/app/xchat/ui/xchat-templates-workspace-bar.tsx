"use client";

type XchatTemplatesWorkspaceBarProps = {
  promptLibraryCount: number;
  askInFlight: boolean;
};

export function XchatTemplatesWorkspaceBar({
  promptLibraryCount,
  askInFlight
}: XchatTemplatesWorkspaceBarProps) {
  return (
    <div className="xchat-workspace-bar" role="region" aria-label="Workspace status">
      <div className="xchat-workspace-bar__status" aria-live="polite">
        <span
          className={`xchat-workspace-bar__pulse${askInFlight ? " xchat-workspace-bar__pulse--live" : ""}`}
          aria-hidden
        />
        <div className="xchat-workspace-bar__status-copy">
          <span className="xchat-workspace-bar__status-line">
            {askInFlight ? "Advisor compiling…" : "Workspace library"}
          </span>
          <span aria-hidden className="xchat-workspace-bar__status-sep">
            ·
          </span>
          <span className="xchat-workspace-bar__status-meta">
            {askInFlight ? "Processing prompt" : `${promptLibraryCount} prompts ready`}
          </span>
        </div>
      </div>
    </div>
  );
}
