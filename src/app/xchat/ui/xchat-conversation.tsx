"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
    FormEvent,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type SVGProps
} from "react";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { RailDisclosure } from "@/app/ui/app-user-rail-nav";
import { LucideSquarePenIcon } from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { WorkspaceProductSidebar } from "@/app/ui/workspace-product-sidebar";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { XchatChatSkeleton } from "@/app/xchat/ui/xchat-chat-skeleton";
import type { HistoryItem, HistoryStats, Message } from "@/app/xchat/ui/xchat-conversation-types";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import { writeStrategyHandoffFromXchat } from "@/lib/xchat-strategy-job-handoff";
import { XCHAT_PENDING_PROMPT_STORAGE_KEY } from "@/lib/xchat/xchat-pending-prompt";
import type { XchatServerShellBootstrap } from "@/lib/xchat/xchat-shell-bootstrap";
import { XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS } from "@/modules/xchat/default-xpersonas";
import { getTeamXaiKbCollectionIdSync } from "@/modules/xchat/team-xai-collection-sync";

const XchatThreadPanelLazy = dynamic(
  () => import("./xchat-thread-panel").then((m) => ({ default: m.XchatThreadPanel })),
  { ssr: false, loading: () => <XchatChatSkeleton variant="thread" /> }
);

const XchatComposerPanelLazy = dynamic(
  () => import("./xchat-composer-panel").then((m) => ({ default: m.XchatComposerPanel })),
  { ssr: false, loading: () => <XchatChatSkeleton variant="composer" /> }
);

const GLOBAL_ADMIN_DEFAULT_PERSONA_PICKER_BLOCK = new Set(
  XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS.map((k) => k.toLowerCase())
);

type AskToolCallSummary = {
  name: string;
  durationMs: number;
};

type XchatPrivacyPrefs = {
  keepLastTenMessages: boolean;
  consentedAt: string | null;
};

function formatLastTurnToolSummary(calls: AskToolCallSummary[] | undefined): string {
  if (!calls || calls.length === 0) {
    return "No tools invoked this turn";
  }
  const totalMs = calls.reduce((sum, c) => sum + c.durationMs, 0);
  const uniqNames = [...new Set(calls.map((c) => c.name))];
  return `${calls.length} call${calls.length === 1 ? "" : "s"} · ${totalMs}ms · ${uniqNames.join(", ")}`;
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

export type XchatConversationProps = {
  accountDetails: AppUserRailAccountPanelDetails;
  /** When set (server: Google OAuth configured), account rail shows “Link Google” for X-first sessions. */
  googleLinkHref?: string | null;
  accountFeedbackPageLabel?: string;
  /** Default workspace portfolio id (watchlist + broker import query). */
  workspacePortfolioId?: string | null;
  /** When true (server resolved `?portfolioId=`), POST once to sync HttpOnly workspace cookie with rail. */
  syncWorkspacePortfolioCookie?: boolean;
  /** Resolved default persona name for this session’s role (e.g. advisor vs atx-trusted-advisor). */
  defaultPublishedPersonaName: string;
  /** Active workspace book for shared portfolio/account pickers in sidebar. */
  workspaceBook?: AppUserDefaultBook | null;
  /** When false, global-admin default personas (advisor / legacy super-agent) are hidden unless assigned. */
  includeSuperAgentInPersonaPicker?: boolean;
  /** Greeting label (display name, handle, or email local-part). */
  welcomeName: string;
  /** Drives Reference Docs + Settings links in the left rail. */
  isGlobalAdmin?: boolean;
  /** Tenant workspace limit: allow switching persona (app users; global_admin ignores). */
  workspaceChangePersonaEnabled?: boolean;
  /** Tenant workspace limit: max recent prompts in thread + history fetch. */
  workspaceChatHistoryMax?: number;
  /** Optional deep-link target from non-xChat pages. */
  initialXchatItem?: "composer" | "persona" | "examples" | "history" | null;
  /** RSC bootstrap: prefs + recent Mongo turns (60s server cache) to avoid cold client waterfalls. */
  serverBootstrap?: XchatServerShellBootstrap | null;
};

/** String = chip shows full text. `{ prompt }` = full text sent on click; chip uses single-line ellipsis in the list. */
type XchatPromptExample = string | { prompt: string };

const THIRTY_DAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const XCHAT_UI_RESPONSE_LIMIT = 3;

const THREAD_MAIN_VIRTUAL_MIN = 18;

function filterRailHistoryItems(items: HistoryItem[], workspaceHistoryMax: number): HistoryItem[] {
  const nowMs = Date.now();
  const cap = Math.max(1, Math.min(500, workspaceHistoryMax));
  return items
    .filter((item) => {
      const createdAtMs = new Date(item.createdAt).getTime();
      return Number.isFinite(createdAtMs) && nowMs - createdAtMs <= THIRTY_DAY_WINDOW_MS;
    })
    .slice(0, cap * 3);
}

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

function buildAskRecentMessages(messages: Message[], maxItems = 10): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  return messages
    .filter((m) => m.role === "user" || m.role === "ai" || m.role === "error")
    .map((m): { role: "user" | "assistant"; content: string } => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content.trim()
    }))
    .filter((m) => m.content.length > 0)
    .slice(-maxItems);
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

function shouldLaunchStrategyJobFromReply(input: string): boolean {
  const t = input.trim().toLowerCase();
  if (!t) {
    return false;
  }
  if (t === "yes" || t === "y") {
    return true;
  }
  if (t.includes("launch strategy job")) {
    return true;
  }
  if (t.includes("start strategy job")) {
    return true;
  }
  if (t.includes("open strategy job")) {
    return true;
  }
  if (t.includes("proceed")) {
    return true;
  }
  return false;
}

function shouldStayInChatFromReply(input: string): boolean {
  const t = input.trim().toLowerCase();
  if (!t) {
    return false;
  }
  return (
    t === "stay in chat" ||
    t.includes("stay in chat") ||
    t === "stay here" ||
    t.includes("continue in chat")
  );
}

function hasPendingStrategyJobOffer(messages: Message[]): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role === "ai" && msg.strategyJobOffer) {
      return true;
    }
    if (msg.role === "user") {
      return false;
    }
  }
  return false;
}

/** Heuristic: longer or multi-structure prompts get a visual nudge toward the structured job path. */
function computeEmphasizeStrategyJobPrimary(fullThread: Message[], aiMsgId: string): boolean {
  const fullIdx = fullThread.findIndex((m) => m.id === aiMsgId);
  if (fullIdx <= 0) {
    return false;
  }
  const prev = fullThread[fullIdx - 1];
  if (prev.role !== "user") {
    return false;
  }
  const c = prev.content;
  return (
    c.length > 480 ||
    /\b(multi-?leg|iron condor|calendar spread|diagonal|butterfly|straddle|strangle)\b/i.test(c)
  );
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
  accountDetails,
  googleLinkHref = null,
  accountFeedbackPageLabel,
  workspacePortfolioId = null,
  syncWorkspacePortfolioCookie = false,
  defaultPublishedPersonaName,
  workspaceBook = null,
  includeSuperAgentInPersonaPicker = false,
  welcomeName,
  isGlobalAdmin: isGlobalAdminSession = false,
  workspaceChangePersonaEnabled = true,
  workspaceChatHistoryMax = 10,
  initialXchatItem = null,
  serverBootstrap = null
}: XchatConversationProps) {
  const router = useRouter();
  const uiPromptLimit = Math.max(1, Math.min(500, workspaceChatHistoryMax));
  const personaPickerLocked =
    !workspaceChangePersonaEnabled && !isGlobalAdminSession;
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!serverBootstrap?.keepLastTenMessages || serverBootstrap.historyItemsNewestFirst.length === 0) {
      return [];
    }
    return historyItemsToTranscriptMessages(serverBootstrap.historyItemsNewestFirst as HistoryItem[]);
  });
  const [strategyJobOptOut, setStrategyJobOptOut] = useState(false);
  const [savedHistory, setSavedHistory] = useState<HistoryItem[]>(() => {
    if (!serverBootstrap?.keepLastTenMessages) {
      return [];
    }
    return filterRailHistoryItems(serverBootstrap.historyItemsNewestFirst as HistoryItem[], workspaceChatHistoryMax);
  });
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePersonaName, setActivePersonaName] = useState(defaultPublishedPersonaName);
  const [lastTurnToolSummary, setLastTurnToolSummary] = useState<string | null>(null);
  const [railXchatUsage, setRailXchatUsage] = useState<{
    lastModel: string | null;
    lastTurn: { input: number; output: number; total: number } | null;
    sessionSum: { input: number; output: number; total: number };
  }>({
    lastModel: null,
    lastTurn: null,
    sessionSum: { input: 0, output: 0, total: 0 }
  });
  const [visibleCollections, setVisibleCollections] = useState<VisibleCollection[]>([]);
  const [, setAssociatedCollectionCount] = useState(1);
  const [collectionsStatus, setCollectionsStatus] = useState<string | null>(null);
  const [collectionsScopeDegraded, setCollectionsScopeDegraded] = useState(false);
  const [personaPickerRows, setPersonaPickerRows] = useState<Array<{ _id: string; name: string }>>([]);
  const [personaListError, setPersonaListError] = useState<string | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [suggestedPersonaId, setSuggestedPersonaId] = useState<string | null>(null);
  const [privacyPrefs, setPrivacyPrefs] = useState<XchatPrivacyPrefs | null>(() =>
    serverBootstrap
      ? {
          keepLastTenMessages: serverBootstrap.keepLastTenMessages,
          consentedAt: serverBootstrap.consentedAt
        }
      : null
  );
  const [privacyPrefsLoading, setPrivacyPrefsLoading] = useState(() => serverBootstrap == null);
  const [privacyPrefsSaving, setPrivacyPrefsSaving] = useState(false);
  const [privacyPrefsError, setPrivacyPrefsError] = useState<string | null>(null);
  const [historyDeleteBusy, setHistoryDeleteBusy] = useState(false);
  const [historyDeleteError, setHistoryDeleteError] = useState<string | null>(null);
  /** After send, hide the transcript for a minimal view; user expands to read the thread. */
  /** Default collapsed when a thread exists; expanded while `loading` so replies stay visible (branding). */
  const [threadUiCollapsed, setThreadUiCollapsed] = useState(true);
  const [threadId] = useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const historyRailScrollRef = useRef<HTMLDivElement | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const threadHydrateStartedRef = useRef(false);
  const skipRailHistoryListFetchOnceRef = useRef(
    Boolean(
      serverBootstrap?.keepLastTenMessages === true &&
        (serverBootstrap.historyItemsNewestFirst?.length ?? 0) > 0
    )
  );
  const pendingComposerFromHandoffRef = useRef(false);
  const userPickedPersonaRef = useRef(false);
  /** Seconds since current ask started (UI only; resets when loading ends). */
  const [askWaitSeconds, setAskWaitSeconds] = useState(0);
  const [strategyJobLaunchBusy, setStrategyJobLaunchBusy] = useState(false);

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
  const threadMainVirtualize = !threadUiCollapsed && visibleThreadMessages.length >= THREAD_MAIN_VIRTUAL_MIN;
  const threadVirtualizer = useVirtualizer({
    count: visibleThreadMessages.length,
    getScrollElement: () => threadScrollRef.current,
    estimateSize: () => 108,
    overscan: 4
  });
  const onStrategyJobLaunch = useCallback(() => {
    if (loading || strategyJobLaunchBusy) {
      return;
    }
    setInput("launch strategy job");
    requestAnimationFrame(() => {
      composerFormRef.current?.requestSubmit();
    });
  }, [loading, strategyJobLaunchBusy]);

  const onStrategyJobStay = useCallback(() => {
    if (loading || strategyJobLaunchBusy) {
      return;
    }
    setInput("stay in chat");
    requestAnimationFrame(() => {
      composerFormRef.current?.requestSubmit();
    });
  }, [loading, strategyJobLaunchBusy]);

  const emphasizeStrategyForMessage = useCallback(
    (aiMsgId: string) => computeEmphasizeStrategyJobPrimary(messages, aiMsgId),
    [messages]
  );

  const historyListVirtualize = savedHistory.length > 14;
  const historyVirtualizer = useVirtualizer({
    count: savedHistory.length,
    getScrollElement: () => historyRailScrollRef.current,
    estimateSize: () => 44,
    overscan: 8
  });
  const historyMode = historyStats?.historyMode ?? (privacyPrefs?.keepLastTenMessages ? "mongo" : "ephemeral");
  const isEphemeralHistoryMode = historyMode === "ephemeral";

  useEffect(() => {
    if (messages.length === 0) {
      setThreadUiCollapsed(false);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!syncWorkspacePortfolioCookie) {
      return;
    }
    const id = workspacePortfolioId?.trim();
    if (!id) {
      return;
    }
    void fetch("/api/user/workspace-portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolioId: id }),
      credentials: "include"
    });
  }, [syncWorkspacePortfolioCookie, workspacePortfolioId]);

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
    if (serverBootstrap != null) {
      return;
    }
    let active = true;
    async function loadPrivacyPrefs() {
      setPrivacyPrefsLoading(true);
      setPrivacyPrefsError(null);
      try {
        const response = await fetch("/api/xchat/preferences", { credentials: "include" });
        const payload = (await response.json().catch(() => ({}))) as {
          data?: XchatPrivacyPrefs;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? `Preferences request failed (${response.status})`);
        }
        if (!active) {
          return;
        }
        const next: XchatPrivacyPrefs = {
          keepLastTenMessages: payload.data?.keepLastTenMessages === true,
          consentedAt: payload.data?.consentedAt ?? null
        };
        setPrivacyPrefs(next);
      } catch (error) {
        if (!active) {
          return;
        }
        setPrivacyPrefs({
          keepLastTenMessages: false,
          consentedAt: null
        });
        setPrivacyPrefsError(error instanceof Error ? error.message : "Failed to load privacy settings");
      } finally {
        if (active) {
          setPrivacyPrefsLoading(false);
        }
      }
    }
    void loadPrivacyPrefs();
    return () => {
      active = false;
    };
  }, [serverBootstrap]);

  useEffect(() => {
    setHistoryLoaded(false);
  }, [privacyPrefs?.keepLastTenMessages]);

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
    if (
      serverBootstrap?.keepLastTenMessages === true &&
      serverBootstrap.historyItemsNewestFirst.length > 0
    ) {
      threadHydrateStartedRef.current = true;
      return;
    }
    if (threadHydrateStartedRef.current) {
      return;
    }
    if (privacyPrefsLoading) {
      return;
    }
    threadHydrateStartedRef.current = true;
    let active = true;
    async function hydrateThreadFromHistory() {
      if (!privacyPrefs?.keepLastTenMessages) {
        return;
      }
      try {
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
  }, [privacyPrefs?.keepLastTenMessages, privacyPrefsLoading, serverBootstrap, uiPromptLimit]);

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
          : rows.filter((r) => !GLOBAL_ADMIN_DEFAULT_PERSONA_PICKER_BLOCK.has(r.name.trim().toLowerCase()));
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
    if (privacyPrefsLoading) {
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
        if (resolvedHistoryMode === "ephemeral" || !privacyPrefs?.keepLastTenMessages) {
          setSavedHistory([]);
          setHistoryLoaded(true);
          return;
        }
        if (skipRailHistoryListFetchOnceRef.current) {
          skipRailHistoryListFetchOnceRef.current = false;
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
        const filteredRecentHistory = filterRailHistoryItems(
          historyPayload.data?.items ?? [],
          workspaceChatHistoryMax
        );
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
  }, [historyLoaded, privacyPrefs?.keepLastTenMessages, privacyPrefsLoading, uiPromptLimit, workspaceChatHistoryMax]);

  useEffect(() => {
    if (!initialXchatItem) {
      return;
    }
    setLeftRailCollapsed(false);
    if (initialXchatItem !== "composer") {
      return;
    }
    queueMicrotask(() => {
      const el = composerRef.current;
      if (!el) {
        return;
      }
      el.focus();
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
    });
  }, [initialXchatItem]);

  const setKeepLastTenMessages = useCallback(
    async (enabled: boolean) => {
      setPrivacyPrefsSaving(true);
      setPrivacyPrefsError(null);
      try {
        const response = await fetch("/api/xchat/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ keepLastTenMessages: enabled })
        });
        const payload = (await response.json().catch(() => ({}))) as {
          data?: XchatPrivacyPrefs;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? `Preferences update failed (${response.status})`);
        }
        setPrivacyPrefs({
          keepLastTenMessages: payload.data?.keepLastTenMessages === true,
          consentedAt: payload.data?.consentedAt ?? null
        });
      } catch (error) {
        setPrivacyPrefsError(error instanceof Error ? error.message : "Failed to update privacy setting");
      } finally {
        setPrivacyPrefsSaving(false);
      }
    },
    []
  );

  const deleteChatHistoryNow = useCallback(async () => {
    setHistoryDeleteBusy(true);
    setHistoryDeleteError(null);
    try {
      const response = await fetch("/api/xchat/history", {
        method: "DELETE",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Delete failed (${response.status})`);
      }
      setSavedHistory([]);
      setMessages([]);
      setStrategyJobOptOut(false);
      setHistoryStats((prev) =>
        prev
          ? {
              ...prev,
              totalPrompts: 0,
              activeDays: 0,
              lastPromptAt: undefined
            }
          : prev
      );
    } catch (error) {
      setHistoryDeleteError(error instanceof Error ? error.message : "Failed to delete chat history");
    } finally {
      setHistoryDeleteBusy(false);
    }
  }, []);

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
    const nextStrategyOptOut = strategyJobOptOut || shouldStayInChatFromReply(prompt);
    if (nextStrategyOptOut !== strategyJobOptOut) {
      setStrategyJobOptOut(nextStrategyOptOut);
    }

    setMessages((prev) => {
      const added = [...prev, userMsg];
      const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
      return next;
    });
    setInput("");
    setLoading(true);

    if (hasPendingStrategyJobOffer(messages) && shouldLaunchStrategyJobFromReply(prompt)) {
      setStrategyJobLaunchBusy(true);
      try {
        const response = await fetch("/api/strategy-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        const payload = (await response.json().catch(() => ({}))) as {
          data?: { jobId?: string; correlationId?: string };
          error?: string;
          message?: string;
        };
        if (!response.ok || !payload.data?.jobId) {
          setMessages((prev) => {
            const added = [
              ...prev,
              {
                id: `error-${Date.now()}`,
                role: "error" as const,
                content:
                  payload.message ??
                  payload.error ??
                  `We couldn't start the structured job right now (${response.status}). Try again in a moment.`,
                timestamp: Date.now()
              }
            ];
            const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
            return next;
          });
          return;
        }
        const jobId = payload.data.jobId;
        writeStrategyHandoffFromXchat(jobId, [...messages, userMsg]);
        setMessages((prev) => {
          const added = [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: "ai" as const,
              content: [
                "Opening your structured strategy job in xStrategyBuilder.",
                "",
                "_Educational conversations only. Not personalized investment advice. Review suitability, assignment risk, and tax impact before execution._"
              ].join("\n"),
              persona: activePersonaName,
              timestamp: Date.now()
            }
          ];
          const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
          return next;
        });
        router.push(`/xstrategybuilder?jobId=${encodeURIComponent(jobId)}&from=xchat`);
        return;
      } catch {
        setMessages((prev) => {
          const added = [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "error" as const,
              content: "Network error while starting the structured job. Check your connection and try again.",
              timestamp: Date.now()
            }
          ];
          const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
          return next;
        });
        return;
      } finally {
        setStrategyJobLaunchBusy(false);
        setLoading(false);
      }
    }

    try {
      const askBody: {
        message: string;
        scope: string;
        threadId: string;
        strategyJobOptOut: boolean;
        recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
        portfolioId?: string;
        personaId?: string;
      } = {
        message: prompt,
        scope: "global",
        threadId,
        strategyJobOptOut: nextStrategyOptOut,
        recentMessages: buildAskRecentMessages(messages, 10)
      };
      const normalizedWorkspacePortfolioId = workspacePortfolioId?.trim();
      if (normalizedWorkspacePortfolioId) {
        askBody.portfolioId = normalizedWorkspacePortfolioId;
      }
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
          strategyJobOffer?: boolean;
          model?: string;
          xaiUsage?: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            reasoningTokens?: number;
            cachedPromptTokens?: number;
          };
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

      const turnModel = payload.data?.model;
      const turnUsage = payload.data?.xaiUsage;
      setRailXchatUsage((prev) => {
        const nextModel =
          typeof turnModel === "string" && turnModel.length > 0 ? turnModel : prev.lastModel;
        if (!turnUsage) {
          return nextModel === prev.lastModel ? prev : { ...prev, lastModel: nextModel };
        }
        const input = Math.max(0, Math.floor(Number(turnUsage.inputTokens) || 0));
        const output = Math.max(0, Math.floor(Number(turnUsage.outputTokens) || 0));
        const totalRaw = Number(turnUsage.totalTokens);
        const total =
          Number.isFinite(totalRaw) && totalRaw > 0
            ? Math.floor(totalRaw)
            : input + output;
        return {
          lastModel: nextModel,
          lastTurn: { input, output, total },
          sessionSum: {
            input: prev.sessionSum.input + input,
            output: prev.sessionSum.output + output,
            total: prev.sessionSum.total + total
          }
        };
      });

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
            serverLogId: logId,
            strategyJobOffer: Boolean(payload.data?.strategyJobOffer)
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
            <span className="xchat-rail-head__brand-zap" aria-hidden>
              <Image
                alt=""
                aria-hidden
                className="xchat-rail-head__brand-mark"
                height={24}
                src="/branding/aTx.png"
                width={24}
              />
            </span>
          ) : null}
          <XfHoverHint hint={leftRailCollapsed ? "Open sidebar" : "Collapse sidebar"}>
            <button
              aria-expanded={!leftRailCollapsed}
              aria-label={leftRailCollapsed ? "Open sidebar" : "Collapse sidebar"}
              className="xchat-rail-toggle"
              type="button"
              onClick={() => setLeftRailCollapsed((prev) => !prev)}
            >
              {leftRailCollapsed ? (
                <Image
                  alt=""
                  aria-hidden
                  className="xchat-rail-head__brand-mark"
                  height={24}
                  src="/branding/aTx.png"
                  width={24}
                />
              ) : (
                <XchatRailCollapseIcon />
              )}
            </button>
          </XfHoverHint>
        </div>
        {!leftRailCollapsed ? (
          <div className="xchat-rail-body">
            <WorkspaceProductSidebar
              accountDetails={accountDetails}
              accountFeedbackPageLabel={accountFeedbackPageLabel}
              defaultPortfolioId={workspacePortfolioId?.trim() ? workspacePortfolioId.trim() : null}
              googleLinkHref={googleLinkHref}
              isGlobalAdmin={isGlobalAdminSession}
              showReferenceDocs
              workspaceBook={workspaceBook}
              xchatSection={(
            <section className="app-user-rail-section" aria-label="xChat">
              <RailDisclosure
                defaultOpen={initialXchatItem !== null}
                icon={<RailSidebarZapIcon className="app-user-rail-disclosure__glyph app-user-rail-disclosure__glyph--zap" size="disclosure" />}
                title="xChat"
              >
                <div className="xchat-rail-subsection">
                  <RailDisclosure
                    defaultOpen={initialXchatItem === "persona"}
                    icon={<PersonaRailGlyph className="app-user-rail-disclosure__glyph" />}
                    title="Persona"
                  >
                    <div className="xchat-rail-persona-panel">
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
                        {railXchatUsage.lastModel ? (
                          <p
                            className="status-text"
                            style={{ fontSize: "0.72rem", margin: "0.35rem 0 0", lineHeight: 1.35 }}
                          >
                            <span style={{ color: "var(--xf-text-muted)" }}>Model: </span>
                            <span className="font-mono" style={{ color: "var(--xf-text-100)" }}>
                              {railXchatUsage.lastModel}
                            </span>
                          </p>
                        ) : null}
                        {railXchatUsage.lastTurn ? (
                          <p
                            className="status-text font-mono"
                            style={{
                              fontSize: "0.68rem",
                              margin: "0.2rem 0 0",
                              lineHeight: 1.35,
                              color: "var(--xf-text-muted)"
                            }}
                          >
                            Last turn: {railXchatUsage.lastTurn.input.toLocaleString("en-US")} in /{" "}
                            {railXchatUsage.lastTurn.output.toLocaleString("en-US")} out /{" "}
                            {railXchatUsage.lastTurn.total.toLocaleString("en-US")} total
                          </p>
                        ) : railXchatUsage.lastModel ? (
                          <p
                            className="status-text"
                            style={{ fontSize: "0.68rem", margin: "0.2rem 0 0", opacity: 0.8 }}
                          >
                            Token counts appear after a model completion with usage.
                          </p>
                        ) : null}
                        {railXchatUsage.sessionSum.total > 0 ||
                        railXchatUsage.sessionSum.input > 0 ||
                        railXchatUsage.sessionSum.output > 0 ? (
                          <p
                            className="status-text font-mono"
                            style={{
                              fontSize: "0.68rem",
                              margin: "0.2rem 0 0",
                              lineHeight: 1.35,
                              color: "var(--xf-text-muted)"
                            }}
                          >
                            Session sum: {railXchatUsage.sessionSum.input.toLocaleString("en-US")} in /{" "}
                            {railXchatUsage.sessionSum.output.toLocaleString("en-US")} out /{" "}
                            {railXchatUsage.sessionSum.total.toLocaleString("en-US")} total
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </RailDisclosure>
                </div>

                <div className="xchat-rail-subsection">
                  <RailDisclosure
                    defaultOpen={initialXchatItem === "composer"}
                    icon={
                      <LucideSquarePenIcon className="app-user-rail-disclosure__glyph app-user-rail-disclosure__glyph--composer" />
                    }
                    title="Composer"
                  >
                    <button
                      className="app-user-rail-sublink xchat-rail-link"
                      type="button"
                      onClick={() => {
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
                      Focus composer
                    </button>
                    <p className="status-text">Shortcuts: Enter send · Shift+Enter newline</p>
                  </RailDisclosure>
                </div>

                <div className="xchat-rail-subsection">
                  <RailDisclosure
                    defaultOpen={initialXchatItem === "examples"}
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
                </div>

                <div className="xchat-rail-subsection">
                  <RailDisclosure
                    defaultOpen={initialXchatItem === "history"}
                    icon={<RecentChatsRailGlyph className="app-user-rail-disclosure__glyph" />}
                    title="Chat history"
                  >
                    <div className="xchat-sidebar-privacy-row">
                      <span className="xchat-sidebar-privacy-row__label">Keep your last 10 messages?</span>
                      <label className="xchat-sidebar-privacy-row__control" aria-label="Keep your last 10 messages">
                        <input
                          checked={privacyPrefs?.keepLastTenMessages === true}
                          disabled={privacyPrefsLoading || privacyPrefsSaving}
                          onChange={(e) => {
                            void setKeepLastTenMessages(e.target.checked);
                          }}
                          type="checkbox"
                        />
                      </label>
                    </div>
                    <details className="xchat-sidebar-privacy-note">
                      <summary className="xchat-sidebar-privacy-note__summary">Privacy details</summary>
                      <div className="xchat-sidebar-privacy-note__body">
                        <p>
                          We can optionally store only your most recent 10 chat messages (encrypted in our database) so conversations continue across sessions and devices.
                        </p>
                        <p>Default = nothing is saved.</p>
                        <p>Stored messages are automatically deleted after 60 days or when you delete the chat.</p>
                        <p>You control this at any time in chat settings.</p>
                        <p>This helps us respect your privacy while giving you continuity if you want it.</p>
                      </div>
                    </details>
                    {privacyPrefsError ? <p className="status-text status-error">{privacyPrefsError}</p> : null}
                    <p className="status-text">Store only if user consents (clear checkbox + one-line explanation at first chat).</p>
                    {isEphemeralHistoryMode ? (
                      <p className="status-text">Recent chats are available once you enable “Keep your last 10 messages?”.</p>
                    ) : null}
                    {!isEphemeralHistoryMode && historyLoading ? <p className="status-text">Loading history...</p> : null}
                    {!isEphemeralHistoryMode && historyError ? <p className="status-text status-error">{historyError}</p> : null}
                    {!isEphemeralHistoryMode && !historyLoading && !historyError && savedHistory.length === 0 ? (
                      <p className="status-text">No past chat history yet.</p>
                    ) : null}
                    {!isEphemeralHistoryMode && !historyLoading && !historyError && savedHistory.length > 0 ? (
                      historyListVirtualize ? (
                        <div
                          ref={historyRailScrollRef}
                          className="xchat-rail-history-list xchat-rail-history-list--virtual"
                          role="list"
                          style={{ maxHeight: 260, overflowY: "auto" }}
                        >
                          <div
                            style={{
                              height: historyVirtualizer.getTotalSize(),
                              position: "relative",
                              width: "100%"
                            }}
                          >
                            {historyVirtualizer.getVirtualItems().map((vi) => {
                              const item = savedHistory[vi.index]!;
                              return (
                                <div
                                  key={item.id}
                                  className="xchat-rail-history-item"
                                  role="listitem"
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    minHeight: vi.size,
                                    transform: `translateY(${vi.start}px)`
                                  }}
                                >
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
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
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
                      )
                    ) : null}
                    <button
                      className="app-user-rail-sublink xchat-rail-link xchat-rail-link--history"
                      disabled={historyDeleteBusy}
                      onClick={() => {
                        void deleteChatHistoryNow();
                      }}
                      type="button"
                    >
                      {historyDeleteBusy ? "Deleting chat history…" : "Delete chat history now"}
                    </button>
                    {historyDeleteError ? <p className="status-text status-error">{historyDeleteError}</p> : null}
                    {!isEphemeralHistoryMode && historyStats ? (
                      <p className="status-text" style={{ fontSize: "0.72rem" }}>
                        {historyStats.totalPrompts} prompts · {historyStats.activeDays} active days
                      </p>
                    ) : null}
                  </RailDisclosure>
                </div>
              </RailDisclosure>
            </section>
              )}
            />
          </div>
        ) : null}
      </aside>

      <div className="xchat-main">
        <header className="xchat-welcome-header">
          <h1 className="xchat-welcome-title">Welcome, {welcomeName}!</h1>
          <p className="xchat-welcome-sub">Overview of xChat — portfolio, watchlist and advisor options-tools. See Examples on left.</p>
        </header>

        <Suspense fallback={<XchatChatSkeleton variant="thread" />}>
          <XchatThreadPanelLazy
            activePersonaName={activePersonaName}
            askWaitSeconds={askWaitSeconds}
            emphasizeStrategyJobPrimary={emphasizeStrategyForMessage}
            loading={loading}
            messages={messages}
            messagesEndRef={messagesEndRef}
            onStrategyJobLaunch={onStrategyJobLaunch}
            onStrategyJobStay={onStrategyJobStay}
            setThreadUiCollapsed={setThreadUiCollapsed}
            strategyJobLaunchBusy={strategyJobLaunchBusy}
            threadMainVirtualize={threadMainVirtualize}
            threadScrollRef={threadScrollRef}
            threadUiCollapsed={threadUiCollapsed}
            threadUiSummary={threadUiSummary}
            threadVirtualizer={threadVirtualizer}
            visibleThreadMessages={visibleThreadMessages}
          />
        </Suspense>

        <Suspense fallback={<XchatChatSkeleton variant="composer" />}>
          <XchatComposerPanelLazy
            composerFormRef={composerFormRef}
            composerRef={composerRef}
            handleSend={handleSend}
            input={input}
            loading={loading}
            personaListError={personaListError}
            personaPickerLocked={personaPickerLocked}
            personaSelectRows={personaSelectRows}
            selectedPersonaId={selectedPersonaId}
            setInput={setInput}
            setSelectedPersonaId={setSelectedPersonaId}
            userPickedPersonaRef={userPickedPersonaRef}
          />
        </Suspense>
      </div>
    </div>
  );
}
