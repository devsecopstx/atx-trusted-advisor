"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
    FormEvent,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { RailDisclosure } from "@/app/ui/app-user-rail-nav";
import { BillingAccessStateBanner } from "@/app/ui/billing-access-state-banner";
import { ChatHistoryRailIcon } from "@/app/ui/chat-history-rail-icon";
import { LucideListBulletsIcon, LucideSquarePenIcon } from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { expandWorkspaceProductRail, WorkspaceProductSidebar } from "@/app/ui/workspace-product-sidebar";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { XchatChatSkeleton } from "@/app/xchat/ui/xchat-chat-skeleton";
import type {
    HistoryItem,
    HistoryStats,
    Message,
    XchatInteractionMeta
} from "@/app/xchat/ui/xchat-conversation-types";
import { XchatRailExamplePromptsList } from "@/app/xchat/ui/xchat-example-prompts";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import { isLikelyMongoObjectIdHex } from "@/lib/mongo-object-id-hex";
import { isRetailPaidSubscriptionPlan } from "@/lib/subscription-plan";
import {
    dispatchWorkspaceAccountChanged,
    writeStoredWorkspaceAccountId
} from "@/lib/workspace-account-selection";
import { canAccessPremiumTenantAttachments } from "@/lib/xchat-premium-attachments-policy";
import { writeStrategyHandoffFromXchat } from "@/lib/xchat-strategy-job-handoff";
import {
    XCHAT_PENDING_PERSONA_NAME_STORAGE_KEY,
    XCHAT_PENDING_PROMPT_STORAGE_KEY
} from "@/lib/xchat/xchat-pending-prompt";
import type { XchatServerShellBootstrap } from "@/lib/xchat/xchat-shell-bootstrap";
import { XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS } from "@/modules/xchat/default-xpersonas";
import type { OptionsActionScanDisplayData } from "@/modules/xchat/options-action-scan-display";
import { personaPreviewLineFromSystemPrompt } from "@/modules/xchat/persona-preview-line";
import {
    XCHAT_REASONING_MODE_STORAGE_KEY,
    type XchatReasoningMode
} from "@/modules/xchat/xchat-reasoning-mode";
const XchatThreadPanelLazy = dynamic(
  () => import("./xchat-thread-panel").then((m) => ({ default: m.XchatThreadPanel })),
  { ssr: false, loading: () => <XchatChatSkeleton variant="thread" /> }
);

const XchatComposerPanelLazy = dynamic(
  () => import("./xchat-composer-panel").then((m) => ({ default: m.XchatComposerPanel })),
  { ssr: false, loading: () => <XchatChatSkeleton variant="composer" /> }
);

type XchatPendingPasteImage = import("./xchat-composer-panel").XchatPendingPasteImage;

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

export type XchatConversationProps = {
  accountDetails: AppUserRailAccountPanelDetails;
  /** When set (server: Google OAuth configured), account rail shows “Link Google” for X-first sessions. */
  googleLinkHref?: string | null;
  accountFeedbackPageLabel?: string;
  /** Default workspace portfolio id (watchlist + broker import query). */
  workspacePortfolioId?: string | null;
  /** When true (server resolved `?portfolioId=`), POST once to sync HttpOnly workspace cookie with rail. */
  syncWorkspacePortfolioCookie?: boolean;
  /** When set with workspacePortfolioId, syncs workspace account pickers (Portfolio desk `?accountId=` deep link). */
  requestedWorkspaceAccountId?: string | null;
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
  /** Optional deep-link target from non-xChat pages (`examples` opens Templates gallery + search). */
  initialXchatItem?:
    | "composer"
    | "persona"
    | "examples"
    | "example-prompts"
    | "history"
    | "attachments"
    | null;
  /** RSC bootstrap: prefs + recent Mongo turns (60s server cache) to avoid cold client waterfalls. */
  serverBootstrap?: XchatServerShellBootstrap | null;
  /** Tenant display name for welcome copy (server: `core_tenants.name` via branding resolver). */
  tenantWorkspaceSessionLabel?: string | null;
  /** Tenant allowlist for workspace rail; pass from server so Resources and routes match policy without client race. */
  visiblePathPrefixes?: string[];
};

/** String = chip shows full text. `{ prompt }` = full text sent on click; chip uses single-line ellipsis in the list. */
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

/** The user turn directly before the latest strategy-job preflight AI message (xStrategyBuilder cards). */
function getSubstantiveUserPromptBeforeLatestStrategyOffer(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === "ai" && m.strategyJobOffer && i > 0 && messages[i - 1]?.role === "user") {
      const raw = messages[i - 1]!.content;
      return raw.trim().length > 0 ? raw : null;
    }
  }
  return null;
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

export function XchatConversation({
  accountDetails,
  googleLinkHref = null,
  accountFeedbackPageLabel,
  workspacePortfolioId = null,
  syncWorkspacePortfolioCookie = false,
  requestedWorkspaceAccountId = null,
  defaultPublishedPersonaName,
  workspaceBook = null,
  includeSuperAgentInPersonaPicker = false,
  welcomeName,
  isGlobalAdmin: isGlobalAdminSession = false,
  workspaceChangePersonaEnabled = true,
  workspaceChatHistoryMax = 10,
  initialXchatItem = null,
  serverBootstrap = null,
  visiblePathPrefixes,
  tenantWorkspaceSessionLabel = null
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
  const [input, setInput] = useState("");
  const [reasoningMode, setReasoningMode] = useState<XchatReasoningMode>("fast");
  const [pendingPasteImage, setPendingPasteImage] = useState<XchatPendingPasteImage | null>(null);
  const [pasteImageError, setPasteImageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePersonaName, setActivePersonaName] = useState(defaultPublishedPersonaName);
  const [personaPickerRows, setPersonaPickerRows] = useState<
    Array<{ _id: string; name: string; previewLine?: string }>
  >([]);
  const [personaListError, setPersonaListError] = useState<string | null>(null);
  const [personaListFetched, setPersonaListFetched] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [suggestedPersonaId, setSuggestedPersonaId] = useState<string | null>(null);
  const [pendingPreferredPersonaName, setPendingPreferredPersonaName] = useState<string | null>(null);
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
    if (typeof window !== "undefined") {
      try {
        const fromUrl = new URLSearchParams(window.location.search).get("thread")?.trim();
        if (fromUrl && fromUrl.length >= 8) {
          return fromUrl;
        }
      } catch {
        /* ignore */
      }
    }
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
  /** After "Stay in chat", re-fill composer with the prompt that triggered the strategy-job offer. */
  const strategyStayRestorePromptRef = useRef<string | null>(null);
  /** Seconds since current ask started (UI only; resets when loading ends). */
  /** Monotonic elapsed ms while `/api/xchat/ask` is in flight (100ms ticks for smooth trading-clock UI). */
  const [askElapsedMs, setAskElapsedMs] = useState(0);
  const [strategyJobLaunchBusy, setStrategyJobLaunchBusy] = useState(false);
  /** Aborts in-flight `fetch` to `/api/xchat/ask` or `/api/strategy-jobs` when the user clicks Stop. */
  const askAbortRef = useRef<AbortController | null>(null);

  const tenantFileUploadEnabled = useMemo(
    () =>
      canAccessPremiumTenantAttachments(
        accountDetails.subscriptionPlan,
        accountDetails.isGlobalAdmin ? ["global_admin"] : []
      ),
    [accountDetails.subscriptionPlan, accountDetails.isGlobalAdmin]
  );

  const sourcesRailHref = useMemo(() => {
    const base = "/xchat?rail=xchat&item=attachments";
    const pid = workspacePortfolioId?.trim();
    if (pid) {
      return `${base}&portfolioId=${encodeURIComponent(pid)}`;
    }
    return base;
  }, [workspacePortfolioId]);

  const threadUiSummary = useMemo(() => {
    const userMsgs = messages.filter((m) => m.role === "user");
    const n = userMsgs.length;
    const last = userMsgs[userMsgs.length - 1];
    let preview = last?.content?.trim() ?? "";
    if (last?.attachmentPreviewUrl) {
      preview = preview.length > 0 ? `${preview} · [Image]` : "[Image]";
    }
    const clipped = preview.length > 64 ? `${preview.slice(0, 64)}…` : preview;
    return { userTurnCount: n, preview: clipped };
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("thread") !== threadId) {
        url.searchParams.set("thread", threadId);
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      /* ignore */
    }
  }, [threadId]);

  const handleMessageFeedback = useCallback((messageId: string, vote: "up" | "down") => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedbackVote: vote } : m)));
  }, []);

  const handleRegeneratePrompt = useCallback((pairedPrompt: string) => {
    setInput(pairedPrompt);
    queueMicrotask(() => composerRef.current?.focus());
  }, []);

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
    strategyStayRestorePromptRef.current = getSubstantiveUserPromptBeforeLatestStrategyOffer(messages);
    setInput("stay in chat");
    requestAnimationFrame(() => {
      composerFormRef.current?.requestSubmit();
    });
  }, [loading, strategyJobLaunchBusy, messages]);

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

  /** `savedHistory` is newest-first; include the clicked turn and all older stored turns (chronological transcript). */
  const applyHistoryItemToThread = useCallback(
    (item: HistoryItem) => {
      const idx = savedHistory.findIndex((h) => h.id === item.id);
      if (idx < 0) {
        return;
      }
      const subset = savedHistory.slice(idx);
      const thread = historyItemsToTranscriptMessages(subset);
      const { next } = trimTranscriptToRecentPrompts(thread, uiPromptLimit);
      setMessages(next);
      setInput("");
      setStrategyJobOptOut(false);
      setThreadUiCollapsed(false);
      expandWorkspaceProductRail();
      queueMicrotask(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        composerRef.current?.focus();
      });
    },
    [savedHistory, uiPromptLimit]
  );

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

  useEffect(() => {
    const pid = workspacePortfolioId?.trim() ?? "";
    const aid = requestedWorkspaceAccountId?.trim() ?? "";
    if (!pid || !aid) {
      return;
    }
    if (!isLikelyMongoObjectIdHex(pid) || !isLikelyMongoObjectIdHex(aid)) {
      return;
    }
    writeStoredWorkspaceAccountId(pid, aid);
    dispatchWorkspaceAccountChanged({ portfolioId: pid, accountId: aid });
  }, [workspacePortfolioId, requestedWorkspaceAccountId]);

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
      if (raw) {
        sessionStorage.removeItem(XCHAT_PENDING_PROMPT_STORAGE_KEY);
        setInput((prev) => {
          if (prev.trim()) {
            return prev;
          }
          pendingComposerFromHandoffRef.current = true;
          return raw;
        });
      }
      const personaName = sessionStorage.getItem(XCHAT_PENDING_PERSONA_NAME_STORAGE_KEY)?.trim();
      if (personaName) {
        sessionStorage.removeItem(XCHAT_PENDING_PERSONA_NAME_STORAGE_KEY);
        setPendingPreferredPersonaName(personaName);
      }
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setAskElapsedMs(0);
      return;
    }
    const started = Date.now();
    setAskElapsedMs(0);
    const id = window.setInterval(() => {
      setAskElapsedMs(Date.now() - started);
    }, 100);
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
          data?: unknown[];
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
          setActivePersonaName(defaultPublishedPersonaName);
          setSuggestedPersonaId(null);
          return;
        }
        if (!active) {
          return;
        }
        setActivePersonaName(payload.metadata?.activePersonaName ?? defaultPublishedPersonaName);
        const suggested = payload.metadata?.assignedPersonaId?.trim() ?? null;
        setSuggestedPersonaId(suggested && suggested.length > 0 ? suggested : null);
      } catch {
        if (!active) {
          return;
        }
        setActivePersonaName(defaultPublishedPersonaName);
        setSuggestedPersonaId(null);
      }
    }
    void loadVisibleCollections();
    return () => {
      active = false;
    };
  }, [defaultPublishedPersonaName]);

  useEffect(() => {
    if (personaPickerLocked) {
      setPersonaPickerRows([]);
      setPersonaListError(null);
      setPersonaListFetched(true);
      return;
    }
    let active = true;
    setPersonaListFetched(false);
    async function loadPersonas() {
      setPersonaListError(null);
      try {
        const res = await fetch("/api/personas");
        const payload = (await res.json().catch(() => ({}))) as {
          data?: Array<{ _id?: string; name?: string; systemPrompt?: string }>;
        };
        if (!res.ok || !active) {
          if (active && !res.ok) {
            setPersonaListError("Could not load persona list");
          }
          return;
        }
        const rows = (Array.isArray(payload.data) ? payload.data : [])
          .map((r) => {
            const previewLine = personaPreviewLineFromSystemPrompt(r.systemPrompt);
            return {
              _id: String(r._id ?? "").trim(),
              name: String(r.name ?? "").trim(),
              ...(previewLine ? { previewLine } : {})
            };
          })
          .filter((r) => r._id && r.name);
        const filtered = includeSuperAgentInPersonaPicker
          ? rows
          : rows.filter((r) => !GLOBAL_ADMIN_DEFAULT_PERSONA_PICKER_BLOCK.has(r.name.trim().toLowerCase()));
        setPersonaPickerRows(filtered);
      } catch {
        if (active) {
          setPersonaListError("Could not load persona list");
        }
      } finally {
        if (active) {
          setPersonaListFetched(true);
        }
      }
    }
    void loadPersonas();
    return () => {
      active = false;
    };
  }, [includeSuperAgentInPersonaPicker, personaPickerLocked]);

  useEffect(() => {
    if (!pendingPreferredPersonaName) {
      return;
    }
    if (personaPickerLocked) {
      setPendingPreferredPersonaName(null);
      return;
    }
    if (!personaListFetched) {
      return;
    }
    const want = pendingPreferredPersonaName.trim().toLowerCase();
    if (personaPickerRows.length > 0) {
      const hit = personaPickerRows.find((p) => p.name.trim().toLowerCase() === want);
      if (hit) {
        userPickedPersonaRef.current = true;
        setSelectedPersonaId(hit._id);
      }
    }
    setPendingPreferredPersonaName(null);
  }, [pendingPreferredPersonaName, personaPickerRows, personaPickerLocked, personaListFetched]);

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
    try {
      const raw = localStorage.getItem(XCHAT_REASONING_MODE_STORAGE_KEY);
      if (raw === "fast" || raw === "expert" || raw === "heavy") {
        setReasoningMode(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(XCHAT_REASONING_MODE_STORAGE_KEY, reasoningMode);
    } catch {
      /* ignore */
    }
  }, [reasoningMode]);

  useEffect(() => {
    if (!initialXchatItem) {
      return;
    }
    expandWorkspaceProductRail();
    if (initialXchatItem !== "composer" && initialXchatItem !== "persona") {
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
    const pastedImage = pendingPasteImage;
    const hasPasteImage = Boolean(pastedImage);
    if ((!prompt && !hasPasteImage) || loading) return;

    if (!shouldStayInChatFromReply(prompt)) {
      strategyStayRestorePromptRef.current = null;
    }

    // Keep thread expanded while a response is in flight so users can read it immediately.
    setThreadUiCollapsed(false);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      ...(pastedImage ? { attachmentPreviewUrl: pastedImage.previewUrl } : {}),
      timestamp: Date.now()
    };
    const pairedUserPromptForTurn = hasPasteImage && !prompt ? "[Pasted image]" : prompt;
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
    const askController = new AbortController();
    askAbortRef.current = askController;
    const askSignal = askController.signal;
    if (hasPasteImage) {
      setPendingPasteImage(null);
      setPasteImageError(null);
    }

    if (hasPendingStrategyJobOffer(messages) && shouldLaunchStrategyJobFromReply(prompt)) {
      setStrategyJobLaunchBusy(true);
      try {
        const response = await fetch("/api/strategy-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: askSignal
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
              timestamp: Date.now(),
              pairedUserPrompt: pairedUserPromptForTurn
            }
          ];
          const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
          return next;
        });
        router.push(`/xstrategybuilder?jobId=${encodeURIComponent(jobId)}&from=xchat`);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
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
        askAbortRef.current = null;
        setStrategyJobLaunchBusy(false);
        setLoading(false);
      }
    }

    try {
      const askBody: {
        message: string;
        imageAttachment?: { mediaType: XchatPendingPasteImage["mediaType"]; dataBase64: string };
        scope: string;
        threadId: string;
        strategyJobOptOut: boolean;
        recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
        portfolioId?: string;
        personaId?: string;
        reasoningMode?: XchatReasoningMode;
      } = {
        message: prompt,
        scope: "global",
        threadId,
        strategyJobOptOut: nextStrategyOptOut,
        recentMessages: buildAskRecentMessages(messages, 10)
      };
      if (hasPasteImage && pastedImage) {
        askBody.imageAttachment = {
          mediaType: pastedImage.mediaType,
          dataBase64: pastedImage.dataBase64
        };
      }
      const normalizedWorkspacePortfolioId = workspacePortfolioId?.trim();
      if (normalizedWorkspacePortfolioId) {
        askBody.portfolioId = normalizedWorkspacePortfolioId;
      }
      const personaIdSent =
        !personaPickerLocked && selectedPersonaId.trim() ? selectedPersonaId.trim() : undefined;
      if (personaIdSent) {
        askBody.personaId = personaIdSent;
      }
      if (reasoningMode !== "fast") {
        askBody.reasoningMode = reasoningMode;
      }

      const response = await fetch("/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(askBody),
        signal: askSignal
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: {
          /** Canonical markdown alias of `response` from `/api/xchat/ask`. */
          content?: string;
          response: string;
          personaName?: string;
          logId?: string;
          toolCalls?: AskToolCallSummary[];
          strategyJobOffer?: boolean;
          optionsActionScan?: OptionsActionScanDisplayData;
          model?: string;
          xaiUsage?: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            reasoningTokens?: number;
            cachedPromptTokens?: number;
          };
          interactionMeta?: XchatInteractionMeta;
        };
        error?: string;
        code?: string;
        dailyLimit?: number;
        hourlyLimit?: number;
        xchatLimitSource?: "tenant_plan_effective";
      };

      if (!response.ok || !payload.data) {
        const limitSuffix =
          payload.code === "xchat_daily_limit_exceeded" && typeof payload.dailyLimit === "number"
            ? ` Workspace daily cap: ${payload.dailyLimit} prompts per UTC day (effective tenant+plan limit from Admin → Tenant workspace, including plan overrides when configured).`
            : payload.code === "xchat_hourly_limit_exceeded" && typeof payload.hourlyLimit === "number"
              ? ` Workspace hourly cap: ${payload.hourlyLimit} prompts per UTC hour (effective tenant+plan limit).`
              : "";
        setMessages((prev) => {
          const added = [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "error" as const,
              content: `${payload.error ?? `Request failed (${response.status})`}${limitSuffix}`,
              timestamp: Date.now()
            }
          ];
          const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
          return next;
        });
        if (strategyStayRestorePromptRef.current && shouldStayInChatFromReply(prompt)) {
          setInput(strategyStayRestorePromptRef.current);
          strategyStayRestorePromptRef.current = null;
        }
        return;
      }

      const resolvedName = payload.data?.personaName ?? activePersonaName;
      setActivePersonaName(resolvedName);

      const logId = typeof payload.data?.logId === "string" ? payload.data.logId : undefined;
      const historyItemId = logId || `local-${Date.now()}`;
      setMessages((prev) => {
        const added = [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "ai" as const,
            content: payload.data?.content ?? payload.data?.response ?? "",
            persona: resolvedName,
            timestamp: Date.now(),
            serverLogId: logId,
            strategyJobOffer: Boolean(payload.data?.strategyJobOffer),
            optionsActionScan: payload.data?.optionsActionScan,
            interactionMeta: payload.data?.interactionMeta,
            pairedUserPrompt: pairedUserPromptForTurn
          }
        ];
        const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
        return next;
      });
      setSavedHistory((prev) => {
        const nextItem: HistoryItem = {
          id: historyItemId,
          message: hasPasteImage && !prompt ? "[Pasted image]" : prompt,
          response: payload.data?.content ?? payload.data?.response ?? "",
          model: "xchat",
          createdAt: new Date().toISOString(),
          personaId: personaIdSent,
          contextReferenceCount: 0,
          toolCallCount: payload.data?.toolCalls?.length ?? 0
        };
        const deduped = prev.filter((item) => item.id !== nextItem.id);
        return [nextItem, ...deduped].slice(0, uiPromptLimit);
      });
      if (strategyStayRestorePromptRef.current && shouldStayInChatFromReply(prompt)) {
        setInput(strategyStayRestorePromptRef.current);
        strategyStayRestorePromptRef.current = null;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        if (strategyStayRestorePromptRef.current && shouldStayInChatFromReply(prompt)) {
          setInput(strategyStayRestorePromptRef.current);
          strategyStayRestorePromptRef.current = null;
        }
        return;
      }
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
      if (strategyStayRestorePromptRef.current && shouldStayInChatFromReply(prompt)) {
        setInput(strategyStayRestorePromptRef.current);
        strategyStayRestorePromptRef.current = null;
      }
    } finally {
      askAbortRef.current = null;
      setLoading(false);
    }
  }

  const cancelAskInFlight = useCallback(() => {
    askAbortRef.current?.abort();
  }, []);

  return (
    <div className="xchat-main-shell">
      <aside className="xchat-left-rail xchat-left-rail--workspace-product">
        <div className="xchat-rail-body xchat-rail-body--workspace-surface">
            <WorkspaceProductSidebar
              accountDetails={accountDetails}
              accountFeedbackPageLabel={accountFeedbackPageLabel}
              defaultPortfolioId={workspacePortfolioId?.trim() ? workspacePortfolioId.trim() : null}
              googleLinkHref={googleLinkHref}
              isGlobalAdmin={isGlobalAdminSession}
              showReferenceDocs
              visiblePathPrefixes={visiblePathPrefixes}
              workspaceBook={workspaceBook}
              xchatSection={(
            <section className="app-user-rail-section app-user-rail-section--workspace-core" aria-label="xChat">
              <RailDisclosure
                defaultOpen={initialXchatItem !== null}
                icon={<RailSidebarZapIcon className="app-user-rail-disclosure__glyph app-user-rail-disclosure__glyph--zap" size="disclosure" />}
                title="xChat"
              >
                <div className="xchat-rail-subsection">
                  <RailDisclosure
                    defaultOpen={initialXchatItem === "composer" || initialXchatItem === "persona"}
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
                    defaultOpen={initialXchatItem === "history"}
                    icon={<ChatHistoryRailIcon className="app-user-rail-disclosure__glyph" />}
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
                                        applyHistoryItemToThread(item);
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
                                    applyHistoryItemToThread(item);
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

                <div className="xchat-rail-subsection">
                  <RailDisclosure
                    defaultOpen={initialXchatItem === "example-prompts"}
                    icon={<LucideListBulletsIcon className="app-user-rail-disclosure__glyph" />}
                    title="Example prompts"
                  >
                    <p className="status-text">
                      Tap a line to fill the composer — edit or send when ready.
                    </p>
                    <XchatRailExamplePromptsList
                      askInFlight={loading}
                      composerRef={composerRef}
                      setInput={setInput}
                    />
                  </RailDisclosure>
                </div>
              </RailDisclosure>
            </section>
              )}
            />
        </div>
      </aside>

      <div className="xchat-main">
        <div className="xchat-main__chat-scroll">
          <details className="xchat-mobile-workspace-info md:hidden">
            <summary className="xchat-mobile-workspace-info__summary">Workspace info · billing</summary>
            <div className="xchat-mobile-workspace-info__body">
              <header className="xchat-welcome-header xchat-welcome-header--in-details">
                <h2 className="xchat-welcome-title">Welcome, {welcomeName}!</h2>
                {tenantWorkspaceSessionLabel ? (
                  <p className="xchat-welcome-tenant">
                    <span className="font-medium text-[var(--xf-text-200)]">
                      Advisor workspace · {tenantWorkspaceSessionLabel}
                    </span>
                  </p>
                ) : null}
                <p className="xchat-welcome-sub xchat-welcome-sub--mobile-compact">
                  Portfolio, watchlist, and options tools — Templates above the composer; Depth sets reasoning.
                </p>
              </header>
              {!isRetailPaidSubscriptionPlan(accountDetails.subscriptionPlan) ? (
                <BillingAccessStateBanner
                  className="billing-access-state-banner--xchat-shell"
                  dismissSessionKey="workspace_v1"
                  persistentDismissIdentity={accountDetails.email}
                />
              ) : null}
            </div>
          </details>

          <div className="hidden md:contents">
            <header className="xchat-welcome-header">
              <h1 className="xchat-welcome-title">Welcome, {welcomeName}!</h1>
              {tenantWorkspaceSessionLabel ? (
                <p className="xchat-welcome-tenant">
                  <span className="xchat-welcome-tenant__full hidden md:inline font-medium text-[var(--xf-text-200)]">
                    Advisor workspace · {tenantWorkspaceSessionLabel} strategy session
                  </span>
                  <span className="xchat-welcome-tenant__short md:hidden font-medium text-[var(--xf-text-200)]">
                    {tenantWorkspaceSessionLabel}
                  </span>
                </p>
              ) : null}
              <p className="xchat-welcome-sub hidden md:block">
                Overview of xChat — portfolio, watchlist, and advisor options tools. Use Templates above the composer for
                starter prompts; Depth (Fast / Expert / Heavy) controls plan-aware reasoning.
              </p>
              <p className="xchat-welcome-sub xchat-welcome-sub--mobile-compact md:hidden">
                Portfolio, watchlist, and options tools — Templates sit above the composer; Depth sets reasoning.
              </p>
            </header>

            {!isRetailPaidSubscriptionPlan(accountDetails.subscriptionPlan) ? (
              <BillingAccessStateBanner
                className="billing-access-state-banner--xchat-shell"
                dismissSessionKey="workspace_v1"
                persistentDismissIdentity={accountDetails.email}
              />
            ) : null}
          </div>

          <Suspense fallback={<XchatChatSkeleton variant="thread" />}>
            <XchatThreadPanelLazy
              activePersonaName={activePersonaName}
              askElapsedMs={askElapsedMs}
              emphasizeStrategyJobPrimary={emphasizeStrategyForMessage}
              loading={loading}
              messages={messages}
              onCancelAsk={cancelAskInFlight}
              onMessageFeedback={handleMessageFeedback}
              onRegeneratePrompt={handleRegeneratePrompt}
              messagesEndRef={messagesEndRef}
              onStrategyJobLaunch={onStrategyJobLaunch}
              onStrategyJobStay={onStrategyJobStay}
              setThreadUiCollapsed={setThreadUiCollapsed}
              strategyJobLaunchBusy={strategyJobLaunchBusy}
              threadId={threadId}
              threadMainVirtualize={threadMainVirtualize}
              threadScrollRef={threadScrollRef}
              threadUiCollapsed={threadUiCollapsed}
              threadUiSummary={threadUiSummary}
              threadVirtualizer={threadVirtualizer}
              visibleThreadMessages={visibleThreadMessages}
            />
          </Suspense>
        </div>

        <Suspense fallback={<XchatChatSkeleton variant="composer" />}>
          <XchatComposerPanelLazy
            composerFormRef={composerFormRef}
            composerRef={composerRef}
            templatesGalleryInitiallyExpanded={initialXchatItem === "examples"}
            handleSend={handleSend}
            input={input}
            loading={loading}
            onCancelAsk={cancelAskInFlight}
            pasteImageError={pasteImageError}
            pendingPasteImage={pendingPasteImage}
            personaListError={personaListError}
            personaPickerLocked={personaPickerLocked}
            personaSelectRows={personaSelectRows}
            reasoningMode={reasoningMode}
            selectedPersonaId={selectedPersonaId}
            setInput={setInput}
            setPasteImageError={setPasteImageError}
            setPendingPasteImage={setPendingPasteImage}
            setReasoningMode={setReasoningMode}
            setSelectedPersonaId={setSelectedPersonaId}
            sourcesRailHref={sourcesRailHref}
            tenantFileUploadEnabled={tenantFileUploadEnabled}
            userPickedPersonaRef={userPickedPersonaRef}
            voiceSessionPersonaLabel={activePersonaName}
          />
        </Suspense>
      </div>
    </div>
  );
}
