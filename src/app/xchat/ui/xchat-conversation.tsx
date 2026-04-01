"use client";

import Link from "next/link";
import {
    FormEvent,
    type KeyboardEvent,
    type SVGProps,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import { SendIcon } from "@/app/admin/ui/crud-icons";
import {
    AppUserAccountRailSection,
    AppUserManageWorkspaceRailSection,
    AppUserOptionsRailSection,
    AppUserResourcesRailSection,
    RailDisclosure
} from "@/app/ui/app-user-rail-nav";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";
import { XCHAT_PENDING_PROMPT_STORAGE_KEY } from "@/lib/xchat/xchat-pending-prompt";
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
  historyMode?: "mongo" | "xai_remote";
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

/** Large gear — expand rail (workspace / settings affordance). */
function XchatRailExpandIcon() {
  return (
    <svg aria-hidden className="xchat-rail-toggle__glyph xchat-rail-toggle__glyph--gear" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function XchatRailCollapseIcon() {
  return (
    <svg aria-hidden className="xchat-rail-toggle__glyph" fill="none" viewBox="0 0 24 24">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M21 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ExamplesRailGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

function RecentChatsRailGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M8 9h8M8 13h5M5 19V6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H10l-5 3v-3H6a2 2 0 01-2-2z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

function PersonaRailGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

/** Narrow left-rail select: keep closed state readable without clipping. */
function compactPersonaOptionLabel(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  const max = 22;
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

type XchatConversationProps = {
  /** Resolved default persona name for this session’s role (e.g. Super-Agent vs atx-trusted-advisor). */
  defaultPublishedPersonaName: string;
  /** Default portfolio + default (or first) custodian account — above persona picker in the left rail. */
  defaultBookLabels?: { portfolioName: string; accountName: string } | null;
  /** When false, Super-Agent is hidden from the picker (app_user cannot use it without admin assignment). */
  includeSuperAgentInPersonaPicker?: boolean;
  /** Greeting label (display name, handle, or email local-part). */
  welcomeName: string;
  /** Drives Reference Docs + Settings links in the left rail. */
  isGlobalAdmin?: boolean;
  /** Tenant workspace limit: allow switching persona (app users; global_admin ignores). */
  workspaceChangePersonaEnabled?: boolean;
  /** Tenant workspace limit: max recent prompts in thread + history fetch. */
  workspaceChatHistoryMax?: number;
};

/** String = chip shows full text. `{ prompt }` = full text sent on click; chip uses single-line ellipsis in the list. */
type XchatPromptExample = string | { prompt: string };

const THIRTY_DAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const XCHAT_UI_RESPONSE_LIMIT = 3;

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

function trimTranscriptToRecentResponses(
  msgs: Message[],
  maxAssistantResponses: number
): Message[] {
  if (msgs.length === 0) {
    return msgs;
  }
  let assistantCount = 0;
  let startIdx = 0;
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i].role === "ai" || msgs[i].role === "error") {
      assistantCount += 1;
      if (assistantCount === maxAssistantResponses) {
        startIdx = i;
        break;
      }
    }
  }
  if (assistantCount < maxAssistantResponses) {
    return msgs;
  }
  return msgs.slice(startIdx);
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
  defaultBookLabels = null,
  includeSuperAgentInPersonaPicker = false,
  welcomeName,
  isGlobalAdmin: isGlobalAdminSession = false,
  workspaceChangePersonaEnabled = true,
  workspaceChatHistoryMax = 10
}: XchatConversationProps) {
  const uiPromptLimit = Math.max(1, Math.min(500, workspaceChatHistoryMax));
  const personaPickerLocked =
    !workspaceChangePersonaEnabled && !isGlobalAdminSession;
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedHistory, setSavedHistory] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(true);
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
  /** Default collapsed when a thread exists; expanded while `loading` so replies stay visible (branding). */
  const [threadUiCollapsed, setThreadUiCollapsed] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const threadHydrateStartedRef = useRef(false);
  const pendingComposerFromHandoffRef = useRef(false);
  const userPickedPersonaRef = useRef(false);
  /** Seconds since current ask started (UI only; resets when loading ends). */
  const [askWaitSeconds, setAskWaitSeconds] = useState(0);

  const threadUiSummary = useMemo(() => {
    const userMsgs = messages.filter((m) => m.role === "user");
    const n = userMsgs.length;
    const lastUser = userMsgs[userMsgs.length - 1]?.content?.trim() ?? "";
    const preview = lastUser.length > 64 ? `${lastUser.slice(0, 64)}…` : lastUser;
    return { userTurnCount: n, preview };
  }, [messages]);
  const visibleThreadMessages = useMemo(
    () => trimTranscriptToRecentResponses(messages, XCHAT_UI_RESPONSE_LIMIT),
    [messages]
  );
  const historyMode = historyStats?.historyMode ?? "mongo";
  const isRemoteHistoryMode = historyMode === "xai_remote";

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

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(XCHAT_PENDING_PROMPT_STORAGE_KEY);
      if (!raw) {
        return;
      }
      sessionStorage.removeItem(XCHAT_PENDING_PROMPT_STORAGE_KEY);
      setInput((prev) => {
        if (prev.trim()) {
          return prev;
        }
        pendingComposerFromHandoffRef.current = true;
        return raw;
      });
    } catch {
      // ignore quota / private mode
    }
  }, []);

  useEffect(() => {
    if (!pendingComposerFromHandoffRef.current) {
      return;
    }
    pendingComposerFromHandoffRef.current = false;
    const id = requestAnimationFrame(() => {
      resizeComposer();
      composerRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [input, resizeComposer]);

  const promptExamples: XchatPromptExample[] = [
    "Show my portfolio allocation",
    "What are my top movers today",
    "Add NVDA to my watchlist",
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
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setAskWaitSeconds(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setAskWaitSeconds(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [loading]);

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
        const statsRes = await fetch("/api/xchat/history/stats");
        const statsPayload = (await statsRes.json().catch(() => ({}))) as {
          data?: HistoryStats;
        };
        if (!statsRes.ok || !active) {
          return;
        }
        if ((statsPayload.data?.historyMode ?? "mongo") === "xai_remote") {
          return;
        }
        const res = await fetch(`/api/xchat/history?limit=${uiPromptLimit}`);
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
  }, [uiPromptLimit]);

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
        const statsRes = await fetch("/api/xchat/history/stats");
        const statsPayload = (await statsRes.json().catch(() => ({}))) as {
          data?: HistoryStats;
          error?: string;
        };
        if (!statsRes.ok) {
          throw new Error(statsPayload.error ?? `History stats request failed (${statsRes.status})`);
        }
        if (!active) {
          return;
        }
        const resolvedHistoryMode = statsPayload.data?.historyMode ?? "mongo";
        setHistoryStats(statsPayload.data ?? null);
        if (resolvedHistoryMode === "xai_remote") {
          setSavedHistory([]);
          setHistoryLoaded(true);
          return;
        }
        const historyRes = await fetch(`/api/xchat/history?limit=${uiPromptLimit}`);
        const historyPayload = (await historyRes.json().catch(() => ({}))) as {
          data?: { items?: HistoryItem[] };
          error?: string;
        };
        if (!historyRes.ok) {
          throw new Error(historyPayload.error ?? `History request failed (${historyRes.status})`);
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
          .slice(0, uiPromptLimit * 3);
        setSavedHistory(filteredRecentHistory);
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
  }, [historyLoaded, uiPromptLimit]);

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
      const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
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
          const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
          return next;
        });
        return;
      }

      const resolvedName = payload.data?.personaName ?? activePersonaName;
      setActivePersonaName(resolvedName);
      setLastTurnToolSummary(formatLastTurnToolSummary(payload.data?.toolCalls));

      const logId = typeof payload.data?.logId === "string" ? payload.data.logId : undefined;
      const historyItemId = logId || `local-${Date.now()}`;
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
        const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
        return next;
      });
      setSavedHistory((prev) => {
        const nextItem: HistoryItem = {
          id: historyItemId,
          message: prompt,
          response: payload.data?.response ?? "",
          model: "xchat",
          createdAt: new Date().toISOString(),
          personaId: effectivePersonaPick || undefined,
          contextReferenceCount: 0,
          toolCallCount: payload.data?.toolCalls?.length ?? 0
        };
        const deduped = prev.filter((item) => item.id !== nextItem.id);
        return [nextItem, ...deduped].slice(0, uiPromptLimit);
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
        const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`xchat-main-shell${leftRailCollapsed ? " xchat-main-shell--rail-collapsed" : ""}`}>
      <aside className={`xchat-left-rail ${leftRailCollapsed ? "xchat-left-rail--collapsed" : ""}`}>
        <div className="xchat-rail-head">
          {!leftRailCollapsed ? (
            <div className="xchat-rail-head__brand">
              <span className="xchat-rail-head__team-label">Workspace</span>
              <span className="xchat-rail-head__team-name">xChat</span>
            </div>
          ) : null}
          <XfHoverHint hint={leftRailCollapsed ? "Open sidebar" : "Collapse sidebar"}>
            <button
              aria-expanded={!leftRailCollapsed}
              aria-label={leftRailCollapsed ? "Open sidebar" : "Collapse sidebar"}
              className="xchat-rail-toggle"
              type="button"
              onClick={() => setLeftRailCollapsed((prev) => !prev)}
            >
              {leftRailCollapsed ? <XchatRailExpandIcon /> : <XchatRailCollapseIcon />}
            </button>
          </XfHoverHint>
        </div>
        {!leftRailCollapsed ? (
          <div className="xchat-rail-body">
            <AppUserManageWorkspaceRailSection
              isGlobalAdmin={isGlobalAdminSession}
              railDisclosureDefaultOpen={false}
            />
            {defaultBookLabels ? (
              <section
                aria-label="Default portfolio and account"
                className="xchat-rail-section xchat-rail-section--book"
              >
                <h3 className="xchat-rail-title xchat-rail-title--caps">Default book</h3>
                <div className="xchat-rail-book-card">
                  <div className="xchat-rail-book-row">
                    <span className="xchat-rail-book-k">Portfolio</span>
                    <XfHoverHint hint="Open portfolio">
                      <Link className="xchat-rail-book-v xchat-rail-book-v--link" href="/portfolio">
                        {defaultBookLabels.portfolioName}
                      </Link>
                    </XfHoverHint>
                  </div>
                  <div className="xchat-rail-book-row">
                    <span className="xchat-rail-book-k">Account</span>
                    <span className="xchat-rail-book-v">{defaultBookLabels.accountName}</span>
                  </div>
                </div>
              </section>
            ) : null}
            <section className="app-user-rail-section" aria-label="Persona">
              <RailDisclosure
                defaultOpen={false}
                icon={<PersonaRailGlyph className="app-user-rail-disclosure__glyph" />}
                title="Persona"
              >
                <div className="xchat-rail-persona-panel">
                  <div className="xchat-composer__persona-wrap xchat-rail-persona-wrap">
                    <label className="xchat-composer__persona-label" htmlFor="xchat-persona-picker">
                      Persona picker
                    </label>
                    <select
                      aria-describedby="xchat-persona-picker-hint"
                      className="xchat-composer__persona-select xchat-rail-persona-select"
                      disabled={
                        personaSelectRows.length === 0 ||
                        Boolean(personaListError) ||
                        personaPickerLocked
                      }
                      id="xchat-persona-picker"
                      onChange={(e) => {
                        userPickedPersonaRef.current = true;
                        setSelectedPersonaId(e.target.value);
                      }}
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
                  <p className="status-text xchat-rail-persona-hint" id="xchat-persona-picker-hint">
                    {personaPickerLocked
                      ? "Your workspace has disabled switching personas; the default applies."
                      : "Choose which published persona to use for this prompt. You can change it anytime before you send."}
                  </p>

                  <div className="xchat-rail-persona-block" aria-label="Active persona and last turn tools">
                    <h3 className="xchat-rail-title xchat-rail-title--caps">Active persona</h3>
                    <div className="xchat-rail-active-persona">
                      <p className="status-text xchat-rail-active-persona-name" style={{ margin: "0 0 0.25rem" }}>
                        <strong>{activePersonaName}</strong>
                      </p>
                      <XfHoverHint
                        hint={
                          lastTurnToolSummary ?? "Tool names and durations from the last completed ask"
                        }
                      >
                        <p
                          className="status-text xchat-rail-last-turn-tools"
                          role="note"
                          style={{ fontSize: "0.72rem", lineHeight: 1.35, margin: 0 }}
                          tabIndex={0}
                        >
                          {lastTurnToolSummary ? (
                            lastTurnToolSummary
                          ) : (
                            <span style={{ opacity: 0.8 }}>Send a message to see tool stats</span>
                          )}
                        </p>
                      </XfHoverHint>
                    </div>
                  </div>

                  <div className="xchat-rail-persona-block" aria-label="Knowledge collections and scope status">
                    <h3 className="xchat-rail-title xchat-rail-title--caps">Status</h3>
                    <p
                      className="status-text"
                      style={{ fontSize: "0.72rem", margin: "0 0 0.35rem", lineHeight: 1.35 }}
                    >
                      Collection list loaded for ask:{" "}
                      {visibleCollections.length > 0
                        ? visibleCollections.map((entry) => entry.collectionName ?? entry.collectionId).join(", ")
                        : "—"}
                    </p>
                    {collectionsScopeDegraded ? (
                      <p
                        className="status-text status-warn"
                        style={{ fontSize: "0.72rem", margin: 0, lineHeight: 1.35 }}
                      >
                        Default Finance scope only — server collection list unavailable (404 or network).
                      </p>
                    ) : null}
                    {collectionsStatus ? (
                      <p
                        className="status-text status-error"
                        style={{ fontSize: "0.72rem", margin: "0.35rem 0 0" }}
                      >
                        {collectionsStatus}
                      </p>
                    ) : null}
                  </div>
                </div>
              </RailDisclosure>
            </section>
            <section className="app-user-rail-section" aria-label="Examples">
              <RailDisclosure
                defaultOpen={false}
                icon={<ExamplesRailGlyph className="app-user-rail-disclosure__glyph" />}
                title="Examples"
              >
                <div className="xchat-rail-link-list">
                  {normalizedExamples.map((prompt, i) => (
                    <XfHoverHint key={`rail-example-${i}`} hint={prompt}>
                      <button
                        className="app-user-rail-sublink xchat-rail-link"
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
                        <span className="xchat-rail-link__text">{prompt}</span>
                      </button>
                    </XfHoverHint>
                  ))}
                </div>
              </RailDisclosure>
            </section>
            <section className="app-user-rail-section" aria-label="Recent chats">
              <RailDisclosure
                defaultOpen={false}
                icon={<RecentChatsRailGlyph className="app-user-rail-disclosure__glyph" />}
                title={isRemoteHistoryMode ? "Recent chats (local archive)" : "Recent chats"}
              >
                {isRemoteHistoryMode ? (
                  <p className="status-text">Remote continuity is active; local Mongo history is hidden.</p>
                ) : null}
                {!isRemoteHistoryMode && historyLoading ? <p className="status-text">Loading history...</p> : null}
                {!isRemoteHistoryMode && historyError ? <p className="status-text status-error">{historyError}</p> : null}
                {!isRemoteHistoryMode && !historyLoading && !historyError && savedHistory.length === 0 ? (
                  <p className="status-text">No past chat history yet.</p>
                ) : null}
                {!isRemoteHistoryMode && !historyLoading && !historyError && savedHistory.length > 0 ? (
                  <ul className="xchat-rail-history-list">
                    {savedHistory.map((item) => (
                      <li className="xchat-rail-history-item" key={item.id}>
                        <XfHoverHint hint={item.message}>
                          <button
                            className="app-user-rail-sublink xchat-rail-link xchat-rail-link--history"
                            type="button"
                            onClick={() => {
                              setInput(item.message);
                              queueMicrotask(() => composerRef.current?.focus());
                            }}
                          >
                            <span className="xchat-rail-link__text">{item.message}</span>
                          </button>
                        </XfHoverHint>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {historyStats ? (
                  <p className="status-text" style={{ fontSize: "0.72rem" }}>
                    {historyStats.totalPrompts} prompts · {historyStats.activeDays} active days
                  </p>
                ) : null}
              </RailDisclosure>
            </section>
            <AppUserOptionsRailSection railDisclosureDefaultOpen={false} />
            <AppUserResourcesRailSection
              isGlobalAdmin={isGlobalAdminSession}
              railDisclosureDefaultOpen={false}
            />
            <AppUserAccountRailSection
              isGlobalAdmin={isGlobalAdminSession}
              railDisclosureDefaultOpen={false}
            />
          </div>
        ) : null}
      </aside>

      <div className="xchat-main">
        <header className="xchat-welcome-header">
          <h1 className="xchat-welcome-title">Welcome, {welcomeName}!</h1>
          <p className="xchat-welcome-sub">Overview of xChat — portoflio, watchlist and advisor options-tools. See Examples on left.</p>
        </header>

      {!(threadUiCollapsed && messages.length > 0 && !loading) ? (
        <p className="status-text" style={{ fontSize: "0.75rem", margin: "0.15rem 0 0.5rem", opacity: 0.9 }}>
          Thread shows your last <strong>{uiPromptLimit}</strong> prompts. Each send is stored server-side in
          {" "}
          Mongo; continuity uses <strong>{isRemoteHistoryMode ? "xAI remote conversation state" : "recent saved turns"}</strong>.
          Persona choice locks after your first
          successful reply in this thread (unless your admin assigned one).
        </p>
      ) : null}

      {threadUiCollapsed && messages.length > 0 && !loading ? (
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
                Start a conversation with <strong>{activePersonaName}</strong> (or choose another persona in the
                sidebar).
              </p>
            </div>
          ) : null}

          {visibleThreadMessages.map((msg) => (
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
            <div
              aria-busy="true"
              aria-live="polite"
              className="xchat-await"
              role="status"
            >
              <div className="xchat-await__row">
                <div className="xchat-typing" aria-hidden>
                  <span className="xchat-typing-dot" />
                  <span className="xchat-typing-dot" />
                  <span className="xchat-typing-dot" />
                </div>
                <div className="xchat-await__copy">
                  <span className="xchat-await__title">Advisor is working</span>
                  <span className="xchat-await__hint">
                    {askWaitSeconds >= 10
                      ? "Still running — portfolio or market tools can take up to a minute."
                      : askWaitSeconds >= 3
                        ? "Your persona may be calling workspace or Yahoo tools…"
                        : "Sending to xAI…"}
                  </span>
                  <span className="xchat-await__timer" aria-label={`Elapsed ${askWaitSeconds} seconds`}>
                    {askWaitSeconds > 0 ? `${askWaitSeconds}s` : "…"}
                  </span>
                </div>
              </div>
              <div aria-hidden className="xchat-await__skeleton">
                <span className="xchat-await__sk-line xchat-await__sk-line--long" />
                <span className="xchat-await__sk-line xchat-await__sk-line--med" />
                <span className="xchat-await__sk-line xchat-await__sk-line--short" />
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      )}

        <div className="xchat-composer-wrap">
          <form className="xchat-composer" onSubmit={handleSend}>
            <div className="xchat-composer__row xchat-composer__row--input">
              <XfHoverHint hint="Attach files (beta — coming soon)">
                <button
                  aria-label="Attach files — beta, not available yet"
                  className="xchat-composer__icon-btn xchat-composer__icon-btn--beta"
                  disabled
                  type="button"
                >
                  <XchatComposerAttachIcon />
                </button>
              </XfHoverHint>
              <XfHoverHint hint="Enter to send · Shift+Enter for a new line">
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
                  placeholder={loading ? "Wait for reply…" : "What's on your mind?"}
                  readOnly={loading}
                  rows={1}
                  value={input}
                />
              </XfHoverHint>
            </div>
            <div className="xchat-composer__row xchat-composer__row--actions">
              <XfHoverHint hint="Model (beta — coming soon)">
                <button
                  aria-label="Model selector — beta, not available yet"
                  className="xchat-composer__auto xchat-composer__icon-btn--beta"
                  disabled
                  type="button"
                >
                  Auto <span className="xchat-composer__chev">▾</span>
                </button>
              </XfHoverHint>
              <XfHoverHint hint="Dictation (beta — coming soon)">
                <button
                  aria-label="Dictation — beta, not available yet"
                  className="xchat-composer__icon-btn xchat-composer__icon-btn--beta"
                  disabled
                  type="button"
                >
                  <XchatComposerMicIcon />
                </button>
              </XfHoverHint>
              <XfHoverHint hint="Voice mode (beta — coming soon)">
                <button
                  aria-label="Voice mode — beta, not available yet"
                  className="xchat-composer__voice xchat-composer__icon-btn--beta"
                  disabled
                  type="button"
                >
                  <XchatComposerWaveformIcon />
                </button>
              </XfHoverHint>
              <button className="xchat-composer__send" disabled={loading || !input.trim()} type="submit">
                <SendIcon className="crud-icon" />
                Send
              </button>
            </div>
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
