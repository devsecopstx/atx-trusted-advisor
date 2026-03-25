"use client";

import {
    FormEvent,
    type KeyboardEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";
import { XPERSONA_SUPER_AGENT_NAME } from "@/modules/xchat/default-xpersonas";
import { getTeamXaiKbCollectionIdSync } from "@/modules/xchat/team-xai-collection-sync";

type Message = {
  id: string;
  role: "user" | "ai" | "error";
  content: string;
  persona?: string;
  timestamp: number;
  /** Mongo `xchat_logs` id after a successful `/api/xchat/ask` (used to sync rolled-off turns to xAI user history). */
  serverLogId?: string;
};

type HistoryItem = {
  id: string;
  message: string;
  response: string;
  model: string;
  createdAt: string;
  personaId?: string;
  contextReferenceCount: number;
  toolCallCount: number;
};

type HistoryStats = {
  totalPrompts: number;
  activeDays: number;
  referencedFileCount: number;
  lastPromptAt?: string;
};

type AskToolCallSummary = {
  name: string;
  durationMs: number;
};

function formatLastTurnToolSummary(calls: AskToolCallSummary[] | undefined): string {
  if (!calls || calls.length === 0) {
    return "No tools invoked this turn";
  }
  const totalMs = calls.reduce((sum, c) => sum + c.durationMs, 0);
  const uniqNames = [...new Set(calls.map((c) => c.name))];
  return `${calls.length} call${calls.length === 1 ? "" : "s"} · ${totalMs}ms · ${uniqNames.join(", ")}`;
}

function XchatComposerAttachIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={20} viewBox="0 0 24 24" width={20}>
      <path d="M16.5 6v11.5a4.5 4.5 0 11-9 0V5a2.5 2.5 0 015 0v10.5a1 1 0 11-2 0V6H9v9.5a3 3 0 106 0V5a4 4 0 00-8 0v12.5a6 6 0 1012 0V6h-1.5z" />
    </svg>
  );
}

function XchatComposerMicIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={20} viewBox="0 0 24 24" width={20}>
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm6-3h-1.7c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72z" />
    </svg>
  );
}

function XchatComposerWaveformIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={18} viewBox="0 0 24 24" width={18}>
      <rect height="10" rx="1" width="3" x="5" y="7" />
      <rect height="16" rx="1" width="3" x="10.5" y="4" />
      <rect height="8" rx="1" width="3" x="16" y="8" />
    </svg>
  );
}

function XchatComposerHintMicIcon() {
  return (
    <svg
      aria-hidden
      className="xchat-composer-hint__mic"
      fill="currentColor"
      height={12}
      viewBox="0 0 24 24"
      width={12}
    >
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3h-2c0 2.76-2.24 5-5 5s-5-2.24-5-5H3c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92z" />
    </svg>
  );
}

type XchatConversationProps = {
  /** Resolved default persona name for this session’s role (e.g. Super-Agent vs atx-trusted-advisor). */
  defaultPublishedPersonaName: string;
  /** When false, Super-Agent is hidden from the picker (app_user cannot use it without admin assignment). */
  includeSuperAgentInPersonaPicker?: boolean;
};

/** String = chip shows full text. `{ prompt }` = full text sent on click; chip uses single-line ellipsis in the list. */
type XchatPromptExample = string | { prompt: string };

const THIRTY_DAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Main thread + lazy history panel: show the same number of recent prompts by default. */
const XCHAT_UI_PROMPT_LIMIT = 10;

function trimTranscriptToRecentPrompts(
  msgs: Message[],
  maxUserPrompts: number
): { next: Message[]; evictedLogIds: string[] } {
  if (msgs.length === 0) {
    return { next: msgs, evictedLogIds: [] };
  }
  let userCount = 0;
  let startIdx = 0;
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i].role === "user") {
      userCount += 1;
      if (userCount === maxUserPrompts) {
        startIdx = i;
        break;
      }
    }
  }
  if (userCount < maxUserPrompts) {
    return { next: msgs, evictedLogIds: [] };
  }
  const evicted = msgs.slice(0, startIdx);
  const evictedLogIds = evicted
    .filter((m) => m.role === "ai" && Boolean(m.serverLogId))
    .map((m) => m.serverLogId as string);
  return { next: msgs.slice(startIdx), evictedLogIds };
}

function requestSyncEvictedTurnsToUserCollection(logIds: string[]) {
  const unique = [...new Set(logIds.filter(Boolean))];
  for (const logId of unique) {
    void fetch("/api/xchat/history/sync-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId })
    }).catch(() => {});
  }
}

function historyItemsToTranscriptMessages(items: HistoryItem[]): Message[] {
  const chronological = [...items].reverse();
  const out: Message[] = [];
  for (const it of chronological) {
    const ts = new Date(it.createdAt).getTime();
    const t = Number.isFinite(ts) ? ts : Date.now();
    out.push({
      id: `hydrate-user-${it.id}`,
      role: "user",
      content: it.message,
      timestamp: t
    });
    out.push({
      id: `hydrate-ai-${it.id}`,
      role: "ai",
      content: it.response,
      persona: undefined,
      timestamp: t,
      serverLogId: it.id
    });
  }
  return out;
}

type VisibleCollection = {
  collectionId: string;
  collectionName?: string;
  source: "atxfinance_default" | "user_history" | "assigned_persona";
};

/** Mirrors `GET /api/xchat/collections` default row when the API is missing (404) or unreachable (sync env only on server; client usually empty). */
const DEFAULT_VISIBLE_COLLECTIONS: VisibleCollection[] = (() => {
  const cid = getTeamXaiKbCollectionIdSync();
  if (!cid) {
    return [];
  }
  return [
    {
      collectionId: cid,
      collectionName: "aTxFinance Default",
      source: "atxfinance_default"
    }
  ];
})();

export function XchatConversation({
  defaultPublishedPersonaName,
  includeSuperAgentInPersonaPicker = false
}: XchatConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedHistory, setSavedHistory] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [exampleExpanded, setExampleExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePersonaName, setActivePersonaName] = useState(defaultPublishedPersonaName);
  const [lastTurnToolSummary, setLastTurnToolSummary] = useState<string | null>(null);
  const [visibleCollections, setVisibleCollections] = useState<VisibleCollection[]>([]);
  const [, setAssociatedCollectionCount] = useState(1);
  const [collectionsStatus, setCollectionsStatus] = useState<string | null>(null);
  const [collectionsScopeDegraded, setCollectionsScopeDegraded] = useState(false);
  const [personaPickerRows, setPersonaPickerRows] = useState<Array<{ _id: string; name: string }>>([]);
  const [personaListError, setPersonaListError] = useState<string | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [assignedPersonaIdLock, setAssignedPersonaIdLock] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const threadHydrateStartedRef = useRef(false);
  const userPickedPersonaRef = useRef(false);

  const personaSelectRows = useMemo(() => {
    if (!assignedPersonaIdLock) {
      return personaPickerRows;
    }
    if (personaPickerRows.some((p) => p._id === assignedPersonaIdLock)) {
      return personaPickerRows;
    }
    return [
      ...personaPickerRows,
      {
        _id: assignedPersonaIdLock,
        name: activePersonaName.trim() || "Assigned persona"
      }
    ];
  }, [assignedPersonaIdLock, personaPickerRows, activePersonaName]);

  const resizeComposer = useCallback(() => {
    const el = composerRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    const maxPx = 320;
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, []);

  const promptExamples: XchatPromptExample[] = [
    "Show my portfolio allocation",
    "What are my top movers today",
    "Covered call ideas for my holdings",
    "Compare SPY vs QQQ trend today",
    "Stress test portfolio for volatility spike",
    "xStrategy",
    "How's the weather today in Austin, TX",
    {
      prompt:
        "I want to refresh my wheel around TSLA and SpaceX or related suppliers, what are the top ten companies or related , that have a high IV that may be good candidates to build a wheel with around TSLA?"
    }
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  useEffect(() => {
    if (threadHydrateStartedRef.current) {
      return;
    }
    threadHydrateStartedRef.current = true;
    let active = true;
    async function hydrateThreadFromHistory() {
      try {
        const res = await fetch(`/api/xchat/history?limit=${XCHAT_UI_PROMPT_LIMIT}`);
        const payload = (await res.json().catch(() => ({}))) as {
          data?: { items?: HistoryItem[] };
        };
        if (!res.ok || !active) {
          return;
        }
        const items = payload.data?.items ?? [];
        if (items.length === 0) {
          return;
        }
        const thread = historyItemsToTranscriptMessages(items);
        setMessages((prev) => (prev.length > 0 ? prev : thread));
      } catch {
        // non-fatal: empty thread until first send
      }
    }
    void hydrateThreadFromHistory();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadVisibleCollections() {
      try {
        const response = await fetch("/api/xchat/collections");
        const payload = (await response.json().catch(() => ({}))) as {
          data?: VisibleCollection[];
          metadata?: {
            activePersonaName?: string;
            associatedCollectionCount?: number;
            assignedPersonaId?: string | null;
          };
          error?: string;
        };
        if (!response.ok) {
          if (!active) {
            return;
          }
          setVisibleCollections(DEFAULT_VISIBLE_COLLECTIONS);
          setAssociatedCollectionCount(1);
          setActivePersonaName(defaultPublishedPersonaName);
          setAssignedPersonaIdLock(null);
          setCollectionsScopeDegraded(true);
          setCollectionsStatus(null);
          return;
        }
        if (!active) {
          return;
        }
        setCollectionsScopeDegraded(false);
        setVisibleCollections(payload.data ?? []);
        setActivePersonaName(payload.metadata?.activePersonaName ?? defaultPublishedPersonaName);
        const lock = payload.metadata?.assignedPersonaId?.trim() ?? null;
        setAssignedPersonaIdLock(lock && lock.length > 0 ? lock : null);
        setAssociatedCollectionCount(
          Number.isInteger(payload.metadata?.associatedCollectionCount)
            ? (payload.metadata?.associatedCollectionCount ?? 1)
            : (payload.data ?? []).length || 1
        );
        setCollectionsStatus(null);
      } catch {
        if (!active) {
          return;
        }
        setVisibleCollections(DEFAULT_VISIBLE_COLLECTIONS);
        setAssociatedCollectionCount(1);
        setActivePersonaName(defaultPublishedPersonaName);
        setAssignedPersonaIdLock(null);
        setCollectionsScopeDegraded(true);
        setCollectionsStatus(null);
      }
    }
    void loadVisibleCollections();
    return () => {
      active = false;
    };
  }, [defaultPublishedPersonaName]);

  useEffect(() => {
    let active = true;
    async function loadPersonas() {
      setPersonaListError(null);
      try {
        const res = await fetch("/api/personas");
        const payload = (await res.json().catch(() => ({}))) as {
          data?: Array<{ _id?: string; name?: string }>;
        };
        if (!res.ok || !active) {
          if (active && !res.ok) {
            setPersonaListError("Could not load persona list");
          }
          return;
        }
        const rows = (Array.isArray(payload.data) ? payload.data : [])
          .map((r) => ({
            _id: String(r._id ?? "").trim(),
            name: String(r.name ?? "").trim()
          }))
          .filter((r) => r._id && r.name);
        const filtered = includeSuperAgentInPersonaPicker
          ? rows
          : rows.filter(
              (r) => r.name.trim().toLowerCase() !== XPERSONA_SUPER_AGENT_NAME.trim().toLowerCase()
            );
        setPersonaPickerRows(filtered);
      } catch {
        if (active) {
          setPersonaListError("Could not load persona list");
        }
      }
    }
    void loadPersonas();
    return () => {
      active = false;
    };
  }, [includeSuperAgentInPersonaPicker]);

  useEffect(() => {
    if (assignedPersonaIdLock) {
      setSelectedPersonaId(assignedPersonaIdLock);
      return;
    }
    if (userPickedPersonaRef.current) {
      return;
    }
    const key = activePersonaName.trim().toLowerCase();
    if (!key || personaPickerRows.length === 0) {
      return;
    }
    const hit = personaPickerRows.find((p) => p.name.trim().toLowerCase() === key);
    if (hit) {
      setSelectedPersonaId(hit._id);
    }
  }, [activePersonaName, personaPickerRows, assignedPersonaIdLock]);

  useEffect(() => {
    if (!historyExpanded || historyLoaded) {
      return;
    }
    let active = true;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const [historyRes, statsRes] = await Promise.all([
          fetch(`/api/xchat/history?limit=${XCHAT_UI_PROMPT_LIMIT}`),
          fetch("/api/xchat/history/stats")
        ]);
        const historyPayload = (await historyRes.json().catch(() => ({}))) as {
          data?: { items?: HistoryItem[] };
          error?: string;
        };
        const statsPayload = (await statsRes.json().catch(() => ({}))) as {
          data?: HistoryStats;
          error?: string;
        };

        if (!historyRes.ok || !statsRes.ok) {
          throw new Error(
            historyPayload.error ??
              statsPayload.error ??
              `History request failed (${historyRes.status}/${statsRes.status})`
          );
        }

        if (!active) {
          return;
        }
        const nowMs = Date.now();
        const filteredRecentHistory = (historyPayload.data?.items ?? [])
          .filter((item) => {
            const createdAtMs = new Date(item.createdAt).getTime();
            return Number.isFinite(createdAtMs) && nowMs - createdAtMs <= THIRTY_DAY_WINDOW_MS;
          })
          .slice(0, XCHAT_UI_PROMPT_LIMIT);
        setSavedHistory(filteredRecentHistory);
        setHistoryStats(statsPayload.data ?? null);
        setHistoryLoaded(true);
      } catch (error) {
        if (!active) {
          return;
        }
        setHistoryError(error instanceof Error ? error.message : "Failed to load history");
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [historyExpanded, historyLoaded]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: Date.now()
    };

    setMessages((prev) => {
      const added = [...prev, userMsg];
      const { next, evictedLogIds } = trimTranscriptToRecentPrompts(added, XCHAT_UI_PROMPT_LIMIT);
      requestSyncEvictedTurnsToUserCollection(evictedLogIds);
      return next;
    });
    setInput("");
    setLoading(true);

    try {
      const askBody: { message: string; scope: string; personaId?: string } = {
        message: prompt,
        scope: "global"
      };
      if (!assignedPersonaIdLock && selectedPersonaId.trim()) {
        askBody.personaId = selectedPersonaId.trim();
      }

      const response = await fetch("/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(askBody)
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: {
          response: string;
          personaName?: string;
          logId?: string;
          toolCalls?: AskToolCallSummary[];
        };
        error?: string;
      };

      if (!response.ok || !payload.data) {
        setMessages((prev) => {
          const added = [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "error" as const,
              content: payload.error ?? `Request failed (${response.status})`,
              timestamp: Date.now()
            }
          ];
          const { next, evictedLogIds } = trimTranscriptToRecentPrompts(added, XCHAT_UI_PROMPT_LIMIT);
          requestSyncEvictedTurnsToUserCollection(evictedLogIds);
          return next;
        });
        return;
      }

      const resolvedName = payload.data?.personaName ?? activePersonaName;
      setActivePersonaName(resolvedName);
      setLastTurnToolSummary(formatLastTurnToolSummary(payload.data?.toolCalls));

      const logId = typeof payload.data?.logId === "string" ? payload.data.logId : undefined;
      setMessages((prev) => {
        const added = [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "ai" as const,
            content: payload.data?.response ?? "",
            persona: resolvedName,
            timestamp: Date.now(),
            serverLogId: logId
          }
        ];
        const { next, evictedLogIds } = trimTranscriptToRecentPrompts(added, XCHAT_UI_PROMPT_LIMIT);
        requestSyncEvictedTurnsToUserCollection(evictedLogIds);
        return next;
      });
    } catch {
      setMessages((prev) => {
        const added = [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "error" as const,
            content: "Network error. Check your connection.",
            timestamp: Date.now()
          }
        ];
        const { next, evictedLogIds } = trimTranscriptToRecentPrompts(added, XCHAT_UI_PROMPT_LIMIT);
        requestSyncEvictedTurnsToUserCollection(evictedLogIds);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="xchat-main">
      <div className="xchat-persona-bar">
        <span className="status-badge status-ready">Active persona</span>
        <span
          className="status-text xchat-last-turn-tools"
          style={{ fontSize: "0.8rem" }}
          title={lastTurnToolSummary ?? "Tool names and durations from the last completed ask"}
        >
          <strong>{activePersonaName}</strong>
          {lastTurnToolSummary ? (
            <>
              {" "}
              | {lastTurnToolSummary}
            </>
          ) : (
            <span style={{ opacity: 0.75 }}> | Send a message to see tool stats</span>
          )}
        </span>
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          Collection list loaded for ask:{" "}
          {visibleCollections.length > 0
            ? visibleCollections.map((entry) => entry.collectionName ?? entry.collectionId).join(", ")
            : "—"}
        </span>
        {collectionsScopeDegraded ? (
          <span className="status-text status-warn" style={{ fontSize: "0.75rem" }}>
            Default Finance scope only — server collection list unavailable (404 or network).
          </span>
        ) : null}
        {collectionsStatus ? <span className="status-text status-error">{collectionsStatus}</span> : null}
      </div>

      <p className="status-text" style={{ fontSize: "0.75rem", margin: "0.15rem 0 0.5rem", opacity: 0.9 }}>
        Thread shows your last <strong>{XCHAT_UI_PROMPT_LIMIT}</strong> prompts. Each send is stored server-side;
        when a completed turn rolls off the thread, it is queued to your personal xChat history collection for
        retrieval. Open <strong>Chat history</strong> below for the saved list.
      </p>

      <div className="xchat-messages">
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <p className="status-text">
              Start a conversation with <strong>{activePersonaName}</strong> (or choose another persona below).
            </p>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div className={`xchat-msg xchat-msg-${msg.role}`} key={msg.id}>
            {msg.role === "ai" && msg.persona ? (
              <small style={{ color: "var(--xf-text-400)", display: "block", marginBottom: "0.3rem" }}>
                {msg.persona}
              </small>
            ) : null}
            {msg.role === "ai" ? (
              <XchatMarkdownBody content={msg.content} />
            ) : (
              <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
            )}
          </div>
        ))}

        {loading ? (
          <div className="xchat-typing">
            <span className="xchat-typing-dot" />
            <span className="xchat-typing-dot" />
            <span className="xchat-typing-dot" />
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="xchat-composer-wrap">
        <form className="xchat-composer" onSubmit={handleSend}>
          <div className="xchat-composer__persona-wrap">
            <label className="xchat-composer__persona-label" htmlFor="xchat-persona-picker">
              Persona
            </label>
            <select
              className="xchat-composer__persona-select"
              disabled={
                Boolean(assignedPersonaIdLock) ||
                personaSelectRows.length === 0 ||
                Boolean(personaListError)
              }
              id="xchat-persona-picker"
              onChange={(e) => {
                userPickedPersonaRef.current = true;
                setSelectedPersonaId(e.target.value);
              }}
              title={
                assignedPersonaIdLock
                  ? "Persona is assigned by your admin"
                  : "Choose which published persona to use for this message"
              }
              value={assignedPersonaIdLock ?? selectedPersonaId}
            >
              {assignedPersonaIdLock ? null : (
                <option value="">Default (role / account)</option>
              )}
              {personaSelectRows.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            {personaListError ? (
              <span className="xchat-composer__persona-err" role="status">
                {personaListError}
              </span>
            ) : null}
          </div>
          <button
            aria-label="Attach files — beta, not available yet"
            className="xchat-composer__icon-btn xchat-composer__icon-btn--beta"
            disabled
            title="Attach files (beta — coming soon)"
            type="button"
          >
            <XchatComposerAttachIcon />
          </button>
          <textarea
            ref={composerRef}
            aria-busy={loading}
            className="xchat-composer__field xchat-composer__textarea"
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key !== "Enter" || e.shiftKey || loading) {
                return;
              }
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }}
            placeholder={loading ? "Thinking..." : "What's on your mind?"}
            readOnly={loading}
            rows={1}
            title="Enter to send · Shift+Enter for a new line"
            value={input}
          />
          <button
            aria-label="Model selector — beta, not available yet"
            className="xchat-composer__auto xchat-composer__icon-btn--beta"
            disabled
            title="Model (beta — coming soon)"
            type="button"
          >
            Auto <span className="xchat-composer__chev">▾</span>
          </button>
          <button
            aria-label="Dictation — beta, not available yet"
            className="xchat-composer__icon-btn xchat-composer__icon-btn--beta"
            disabled
            title="Dictation (beta — coming soon)"
            type="button"
          >
            <XchatComposerMicIcon />
          </button>
          <button
            aria-label="Voice mode — beta, not available yet"
            className="xchat-composer__voice xchat-composer__icon-btn--beta"
            disabled
            title="Voice mode (beta — coming soon)"
            type="button"
          >
            <XchatComposerWaveformIcon />
          </button>
          <button className="xchat-composer__send" disabled={loading || !input.trim()} type="submit">
            Send
          </button>
        </form>
        <p className="xchat-composer-hint" role="note">
          <span className="xchat-composer-hint__pill">Beta</span>
          <span className="xchat-composer-hint__text">
            <XchatComposerHintMicIcon />
            New · Hold Ctrl+D to dictate
          </span>
        </p>
      </div>

      <section className="xchat-below-input-panels">
        <article className="xchat-collapsible-panel">
          <button
            aria-expanded={exampleExpanded}
            className="xchat-panel-toggle"
            onClick={() => setExampleExpanded((prev) => !prev)}
            type="button"
          >
            <span className="status-badge status-ready">Example prompts</span>
            <span className="status-text">{exampleExpanded ? "Collapse" : "Expand"}</span>
          </button>
          {exampleExpanded ? (
            <div className="xchat-panel-body">
              <p className="status-text xchat-panel-hint">
                Finance-focused examples for quick starts. Click to load into the composer (long prompts show … in the
                list, then expand in the input — full text is sent to the API).
              </p>
              <div className="xchat-example-grid">
                {promptExamples.map((ex, i) => {
                  const isEllipsisChip = typeof ex !== "string";
                  const full = typeof ex === "string" ? ex : ex.prompt;
                  return (
                    <button
                      aria-label={`Use example: ${full}`}
                      className={
                        isEllipsisChip
                          ? "xchat-example-chip xchat-example-chip--ellipsis"
                          : "xchat-example-chip"
                      }
                      key={`ex-${i}`}
                      title={isEllipsisChip ? full : undefined}
                      type="button"
                      onClick={() => {
                        setInput(full);
                        queueMicrotask(() => {
                          const el = composerRef.current;
                          if (el) {
                            el.focus();
                            el.style.height = "auto";
                            el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
                          }
                        });
                      }}
                    >
                      {full}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </article>

        <article className="xchat-collapsible-panel">
          <button
            aria-expanded={historyExpanded}
            className="xchat-panel-toggle"
            onClick={() => setHistoryExpanded((prev) => !prev)}
            type="button"
          >
            <span className="status-badge status-ready">Chat history</span>
            <span className="status-text">{historyExpanded ? "Collapse" : "Expand"}</span>
          </button>
          {historyExpanded ? (
            <div className="xchat-panel-body">
              <p className="status-text xchat-panel-hint">
                Last {XCHAT_UI_PROMPT_LIMIT} prompts in the last 30 days (lazy-loaded on first expand).
              </p>
              <div className="xchat-history-stats">
                <span className="chip">Prompts: {historyStats?.totalPrompts ?? 0}</span>
                <span className="chip">Active days: {historyStats?.activeDays ?? 0}</span>
                <span className="chip">
                  Collection files seen: {historyStats?.referencedFileCount ?? 0}
                </span>
              </div>
              {historyLoading ? <p className="status-text">Loading history...</p> : null}
              {historyError ? <p className="status-text status-error">{historyError}</p> : null}
              {!historyLoading && !historyError && savedHistory.length === 0 ? (
                <p className="status-text">No recent history yet in the last 30 days.</p>
              ) : null}
              {!historyLoading && !historyError && savedHistory.length > 0 ? (
                <ul className="xchat-history-list">
                  {savedHistory.map((item) => (
                    <li className="xchat-history-item" key={item.id}>
                      <div className="xchat-history-item-head">
                        <strong>{new Date(item.createdAt).toLocaleString()}</strong>
                        <span>{item.model}</span>
                      </div>
                      <p className="xchat-history-item-prompt">{item.message}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
