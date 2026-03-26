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

function XchatThreadExpandChevronIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={22} viewBox="0 0 24 24" width={22}>
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6-1.41-1.41z" />
    </svg>
  );
}

function XchatThreadCollapseChevronIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={18} viewBox="0 0 24 24" width={18}>
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z" />
    </svg>
  );
}

type RailAvatarProps = {
  label: string;
};

function getAvatarInitials(input: string): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  return (input.trim().slice(0, 2) || "U").toUpperCase();
}

function RailAvatar({ label }: RailAvatarProps) {
  return (
    <span aria-hidden className="xchat-rail-avatar">
      {getAvatarInitials(label)}
    </span>
  );
}

function compactPersonaOptionLabel(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  if (normalized.length <= 32) {
    return normalized;
  }
  return `${normalized.slice(0, 29)}...`;
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
): { next: Message[] } {
  if (msgs.length === 0) {
    return { next: msgs };
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
    return { next: msgs };
  }
  return { next: msgs.slice(startIdx) };
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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
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
  const [suggestedPersonaId, setSuggestedPersonaId] = useState<string | null>(null);
  /** After send, hide the transcript for a minimal view; user expands to read the thread. */
  const [threadUiCollapsed, setThreadUiCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const threadHydrateStartedRef = useRef(false);
  const userPickedPersonaRef = useRef(false);

  const threadUiSummary = useMemo(() => {
    const userMsgs = messages.filter((m) => m.role === "user");
    const n = userMsgs.length;
    const lastUser = userMsgs[userMsgs.length - 1]?.content?.trim() ?? "";
    const preview = lastUser.length > 64 ? `${lastUser.slice(0, 64)}…` : lastUser;
    return { userTurnCount: n, preview };
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setThreadUiCollapsed(false);
    }
  }, [messages.length]);

  const personaSelectRows = useMemo(() => personaPickerRows, [personaPickerRows]);

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

  const normalizedExamples = promptExamples.map((item) => (typeof item === "string" ? item : item.prompt));

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
          setSuggestedPersonaId(null);
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
        const suggested = payload.metadata?.assignedPersonaId?.trim() ?? null;
        setSuggestedPersonaId(suggested && suggested.length > 0 ? suggested : null);
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
        setSuggestedPersonaId(null);
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
    if (suggestedPersonaId && !userPickedPersonaRef.current) {
      setSelectedPersonaId(suggestedPersonaId);
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
  }, [activePersonaName, personaPickerRows, suggestedPersonaId]);

  useEffect(() => {
    if (historyLoaded) {
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
          .slice(0, XCHAT_UI_PROMPT_LIMIT * 3);
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
  }, [historyLoaded]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    // Keep thread expanded while a response is in flight so users can read it immediately.
    setThreadUiCollapsed(false);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: Date.now()
    };

    setMessages((prev) => {
      const added = [...prev, userMsg];
      const { next } = trimTranscriptToRecentPrompts(added, XCHAT_UI_PROMPT_LIMIT);
      return next;
    });
    setInput("");
    setLoading(true);

    try {
      const askBody: { message: string; scope: string; personaId?: string } = {
        message: prompt,
        scope: "global"
      };
      const effectivePersonaPick = selectedPersonaId.trim();
      if (effectivePersonaPick) {
        askBody.personaId = effectivePersonaPick;
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
          const { next } = trimTranscriptToRecentPrompts(added, XCHAT_UI_PROMPT_LIMIT);
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
        const { next } = trimTranscriptToRecentPrompts(added, XCHAT_UI_PROMPT_LIMIT);
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
        const { next } = trimTranscriptToRecentPrompts(added, XCHAT_UI_PROMPT_LIMIT);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="xchat-main-shell">
      <aside className={`xchat-left-rail ${leftRailCollapsed ? "xchat-left-rail--collapsed" : ""}`}>
        <div className="xchat-rail-head">
          <button
            aria-expanded={!leftRailCollapsed}
            className="xchat-rail-toggle"
            type="button"
            onClick={() => setLeftRailCollapsed((prev) => !prev)}
          >
            {leftRailCollapsed ? "Open" : "Collapse"}
          </button>
          {!leftRailCollapsed ? <span className="status-badge status-ready">History & examples</span> : null}
        </div>
        {!leftRailCollapsed ? (
          <div className="xchat-rail-body">
            <section className="xchat-rail-section">
              <h3 className="xchat-rail-title">Persona</h3>
              <div className="xchat-composer__persona-wrap">
                <label className="xchat-composer__persona-label" htmlFor="xchat-persona-picker">
                  Persona picker
                </label>
                <select
                  className="xchat-composer__persona-select"
                  disabled={
                    personaSelectRows.length === 0 ||
                    Boolean(personaListError)
                  }
                  id="xchat-persona-picker"
                  onChange={(e) => {
                    userPickedPersonaRef.current = true;
                    setSelectedPersonaId(e.target.value);
                  }}
                  title={
                    "Choose which published persona to use for this prompt. You can change it anytime."
                  }
                  value={selectedPersonaId}
                >
                  <option value="">Default (role / account)</option>
                  {personaSelectRows.map((p) => (
                    <option key={p._id} title={p.name} value={p._id}>
                      {compactPersonaOptionLabel(p.name)}
                    </option>
                  ))}
                </select>
                {personaListError ? (
                  <span className="xchat-composer__persona-err" role="status">
                    {personaListError}
                  </span>
                ) : null}
              </div>
              <p className="status-text" style={{ fontSize: "0.72rem" }}>
                Pick persona per prompt. You can change it any time before sending.
              </p>
            </section>
            <section className="xchat-rail-section">
              <h3 className="xchat-rail-title">Examples</h3>
              <div className="xchat-rail-link-list">
                {normalizedExamples.map((prompt, i) => (
                  <button
                    className="xchat-rail-link"
                    key={`rail-example-${i}`}
                    title={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt);
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
                    <RailAvatar label={prompt} />
                    <span className="xchat-rail-link__text">{prompt}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="xchat-rail-section">
              <h3 className="xchat-rail-title">Recent chats</h3>
              {historyLoading ? <p className="status-text">Loading history...</p> : null}
              {historyError ? <p className="status-text status-error">{historyError}</p> : null}
              {!historyLoading && !historyError && savedHistory.length === 0 ? (
                <p className="status-text">No past chat history yet.</p>
              ) : null}
              {!historyLoading && !historyError && savedHistory.length > 0 ? (
                <ul className="xchat-rail-history-list">
                  {savedHistory.map((item) => (
                    <li className="xchat-rail-history-item" key={item.id}>
                      <button
                        className="xchat-rail-link xchat-rail-link--history"
                        type="button"
                        title={item.message}
                        onClick={() => {
                          setInput(item.message);
                          queueMicrotask(() => composerRef.current?.focus());
                        }}
                      >
                        <RailAvatar label={item.message} />
                        <span className="xchat-rail-link__text">{item.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {historyStats ? (
                <p className="status-text" style={{ fontSize: "0.72rem" }}>
                  {historyStats.totalPrompts} prompts · {historyStats.activeDays} active days
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </aside>

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

      {!(threadUiCollapsed && messages.length > 0) ? (
        <p className="status-text" style={{ fontSize: "0.75rem", margin: "0.15rem 0 0.5rem", opacity: 0.9 }}>
          Thread shows your last <strong>{XCHAT_UI_PROMPT_LIMIT}</strong> prompts. Each send is stored server-side in
          Mongo; prior turns are injected into the next ask for continuity. Open <strong>Chat history</strong> below
          for the saved list. Persona choice locks after your first successful reply in this thread (unless your
          admin assigned one).
        </p>
      ) : null}

      {threadUiCollapsed && messages.length > 0 ? (
        <button
          aria-expanded={false}
          className="xchat-thread-collapsed-bar"
          type="button"
          onClick={() => {
            setThreadUiCollapsed(false);
            queueMicrotask(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }));
          }}
        >
          <span aria-hidden className="xchat-thread-collapsed-bar__icon">
            <XchatThreadExpandChevronIcon />
          </span>
          <span className="xchat-thread-collapsed-bar__meta">
            <span className="xchat-thread-collapsed-bar__title">
              {loading
                ? "Assistant is replying…"
                : `Conversation · ${threadUiSummary.userTurnCount} prompt${threadUiSummary.userTurnCount === 1 ? "" : "s"}`}
            </span>
            {threadUiSummary.preview ? (
              <span className="xchat-thread-collapsed-bar__preview">{threadUiSummary.preview}</span>
            ) : null}
          </span>
          <span className="xchat-thread-collapsed-bar__action">Expand</span>
        </button>
      ) : (
        <div className="xchat-messages">
          {messages.length > 0 ? (
            <button
              aria-expanded
              className="xchat-thread-minimize"
              type="button"
              onClick={() => setThreadUiCollapsed(true)}
            >
              <XchatThreadCollapseChevronIcon />
              <span>Minimize thread</span>
            </button>
          ) : null}

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
      )}

        <div className="xchat-composer-wrap">
          <form className="xchat-composer" onSubmit={handleSend}>
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
      </div>
    </div>
  );
}
