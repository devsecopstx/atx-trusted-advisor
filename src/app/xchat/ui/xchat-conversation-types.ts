import type { OptionsActionScanDisplayData } from "@/modules/xchat/options-action-scan-display";

export type XchatInteractionMeta = {
  generationMs: number;
  sources: {
    ragChunks: number;
    toolInvocations: number;
    personaCollections: number;
    total: number;
  };
};

export type Message = {
  id: string;
  role: "user" | "ai" | "error";
  content: string;
  /** Inline preview for pasted screenshots (data URL or blob URL); not sent back to `/api/xchat/ask` in history. */
  attachmentPreviewUrl?: string;
  persona?: string;
  timestamp: number;
  /** Mongo `xchat_logs` id after a successful `/api/xchat/ask` (used to sync rolled-off turns to xAI user history). */
  serverLogId?: string;
  /** Server suggested handoff to `/xoptions?strategyJob=1` (strategy_job_preflight). */
  strategyJobOffer?: boolean;
  /** Structured options action scan payload for rich table rendering. */
  optionsActionScan?: OptionsActionScanDisplayData;
  /** Server timing + source counts from `/api/xchat/ask`. */
  interactionMeta?: XchatInteractionMeta;
  /** User prompt that produced this assistant message (regenerate). */
  pairedUserPrompt?: string;
  feedbackVote?: "up" | "down" | null;
};

export type HistoryItem = {
  id: string;
  message: string;
  response: string;
  model: string;
  createdAt: string;
  personaId?: string;
  contextReferenceCount: number;
  toolCallCount: number;
  interactionGenerationMs?: number;
};

export type HistoryStats = {
  totalPrompts: number;
  activeDays: number;
  referencedFileCount: number;
  lastPromptAt?: string;
  historyMode?: "mongo" | "ephemeral";
};
