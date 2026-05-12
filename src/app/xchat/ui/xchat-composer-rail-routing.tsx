"use client";

import type { XchatReasoningMode } from "@/modules/xchat/xchat-reasoning-mode";

export type XchatComposerRailLastTurnRouting = {
  executionModel?: string;
  modelSelectionSource?: string;
  contextSource?: string;
  contextCount?: number;
  collectionSearchStatus?: string;
  collectionSearchNonReadyFileCount?: number;
};

export type XchatAskRoutingWire = {
  model?: string;
  modelSelectionSource?: string;
  contextSource?: string;
  contextCount?: number;
  collectionSearchStatus?: string;
  collectionSearchNonReadyFileCount?: number;
};

export function xchatAskDataToComposerRailLastTurn(
  data: XchatAskRoutingWire
): XchatComposerRailLastTurnRouting {
  return {
    executionModel: data.model,
    modelSelectionSource: data.modelSelectionSource,
    contextSource: data.contextSource,
    contextCount: data.contextCount,
    collectionSearchStatus: data.collectionSearchStatus,
    collectionSearchNonReadyFileCount: data.collectionSearchNonReadyFileCount
  };
}

export type XchatComposerRailRoutingProps = {
  personaName: string;
  personaModel?: string;
  reasoningMode: XchatReasoningMode;
  lastTurn?: XchatComposerRailLastTurnRouting;
};

export function formatXchatComposerRagLine(lastTurn: XchatComposerRailLastTurnRouting | undefined): string {
  if (!lastTurn) {
    return "RAG · send a turn to confirm Finance collection grounding";
  }
  const status = lastTurn.collectionSearchStatus?.trim() || "unknown";
  const source = lastTurn.contextSource?.trim() || "none";
  const chunks = typeof lastTurn.contextCount === "number" ? lastTurn.contextCount : 0;
  const blocked =
    typeof lastTurn.collectionSearchNonReadyFileCount === "number" &&
    lastTurn.collectionSearchNonReadyFileCount > 0
      ? ` · ${lastTurn.collectionSearchNonReadyFileCount} non-ready file(s)`
      : "";
  return `RAG · ${source} · ${chunks} chunk(s) · ${status}${blocked}`;
}

export function XchatComposerRailRouting({
  personaName,
  personaModel,
  reasoningMode,
  lastTurn
}: XchatComposerRailRoutingProps) {
  const personaLabel = personaName.trim() || "Persona";
  const configuredModel = personaModel?.trim();
  const executionModel = lastTurn?.executionModel?.trim();
  const selectionSource = lastTurn?.modelSelectionSource?.trim();

  return (
    <div className="xchat-rail-token-stats" role="region" aria-label="xChat model and RAG routing">
      <p className="status-text xchat-rail-token-stats__line">
        Persona · <span className="xchat-rail-token-stats__value">{personaLabel}</span>
      </p>
      <p className="status-text xchat-rail-token-stats__line">
        Persona model ·{" "}
        <span className="xchat-rail-token-stats__value">{configuredModel || "loading…"}</span>
      </p>
      <p className="status-text xchat-rail-token-stats__line">
        Depth · <span className="xchat-rail-token-stats__value">{reasoningMode}</span>
      </p>
      <p className="status-text xchat-rail-token-stats__line">
        Last turn model ·{" "}
        <span className="xchat-rail-token-stats__value">{executionModel || "—"}</span>
        {executionModel && selectionSource ? (
          <span className="xchat-rail-token-stats__line--muted"> ({selectionSource})</span>
        ) : null}
      </p>
      <p className="status-text xchat-rail-token-stats__line xchat-rail-token-stats__line--muted">
        {formatXchatComposerRagLine(lastTurn)}
      </p>
    </div>
  );
}
