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
};

export type HistoryStats = {
  totalPrompts: number;
  activeDays: number;
  referencedFileCount: number;
  lastPromptAt?: string;
  historyMode?: "mongo" | "ephemeral";
};
