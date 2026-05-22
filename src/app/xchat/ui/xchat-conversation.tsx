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
    type ReactNode
} from "react";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { RailDisclosure } from "@/app/ui/app-user-rail-nav";
import { BillingAccessStateBanner } from "@/app/ui/billing-access-state-banner";
import { ChatHistoryRailIcon } from "@/app/ui/chat-history-rail-icon";
import { LucideListBulletsIcon, LucideSquarePenIcon } from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import {
    collapseWorkspaceProductRail,
    expandWorkspaceProductRail,
    WorkspaceProductSidebar
} from "@/app/ui/workspace-product-sidebar";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { XchatUsageMeter } from "@/app/xchat/ui/usage-meter";
import { XchatAdvisorWorkingOverlay } from "@/app/xchat/ui/xchat-advisor-working-overlay";
import {
    buildXchatAskLimitBannerMarkdown,
    isXchatUsageLimitCode
} from "@/app/xchat/ui/xchat-ask-limit-banner";
import { XchatChatSkeleton } from "@/app/xchat/ui/xchat-chat-skeleton";
import {
    xchatAskDataToComposerRailLastTurn,
    XchatComposerRailRouting,
    type XchatComposerRailLastTurnRouting
} from "@/app/xchat/ui/xchat-composer-rail-routing";
import type {
    HistoryItem,
    HistoryStats,
    Message,
    ThreadItem,
    XchatInteractionMeta
} from "@/app/xchat/ui/xchat-conversation-types";
import { XchatRailExamplePromptsList } from "@/app/xchat/ui/xchat-example-prompts";
import { XchatOutlookFreshnessBadge } from "@/app/xchat/ui/xchat-outlook-freshness-badge";
import { XchatUsageStatusRow } from "@/app/xchat/ui/xchat-usage-status-row";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import { isLikelyMongoObjectIdHex } from "@/lib/mongo-object-id-hex";
import { isRetailPaidSubscriptionPlan } from "@/lib/subscription-plan";
import {
    dispatchWorkspaceAccountChanged,
    writeStoredWorkspaceAccountId
} from "@/lib/workspace-account-selection";
import {
    consumeXchatAskSseResponse,
    mergeLiveToolStatusRow
} from "@/lib/xchat-live-sse-client";
import { resolveXchatClientLiveSseEnabled } from "@/lib/xchat-live-sse-policy";
import { canAccessPremiumTenantAttachments } from "@/lib/xchat-premium-attachments-policy";
import { writeStrategyHandoffFromXchat } from "@/lib/xchat-strategy-job-handoff";
import { getXchatComposerTextareaMaxPx } from "@/lib/xchat/xchat-composer-textarea-max";
import type { XchatInitialOutlookDesk } from "@/lib/xchat/xchat-outlook-desk";
import {
    clearXchatPendingComposerHandoffMemory,
    consumeXchatPendingComposerHandoff
} from "@/lib/xchat/xchat-pending-prompt";
import type { XchatServerShellBootstrap } from "@/lib/xchat/xchat-shell-bootstrap";
import {
    anchorXchatThreadViewportAfterTurn,
    clearXchatComposerDraft
} from "@/lib/xchat/xchat-thread-viewport-anchor";
import { advisorComplianceWorkspaceRedirectPath } from "@/modules/compliance/advisor-compliance-redirect";
import { XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS } from "@/modules/xchat/default-xpersonas";
import type { OptionsActionScanDisplayData } from "@/modules/xchat/options-action-scan-display";
import { personaPreviewLineFromSystemPrompt } from "@/modules/xchat/persona-preview-line";
import { isHnwiPromptTemplateV21Slug } from "@/modules/xchat/prompt-templates-v21-defaults";
import {
    personaDefaultReasoningMode,
    shouldForceReasoningModeForPersona,
    XCHAT_REASONING_MODE_STORAGE_KEY,
    XPERSONA_NAME_QUANT_TRADER,
    type XchatReasoningMode
} from "@/modules/xchat/xchat-reasoning-mode";

/** Client fallback when `serverBootstrap.liveSseEnabled` is absent (SSR dynamic route edge cases). */
const XCHAT_LIVE_SSE_ENV_FALLBACK = resolveXchatClientLiveSseEnabled();

const XchatThreadPanelLazy = dynamic(
  () => import("./xchat-thread-panel").then((m) => ({ default: m.XchatThreadPanel })),
  { ssr: false, loading: () => <XchatChatSkeleton variant="thread" /> }
);

const XchatComposerPanelLazy = dynamic(
  () => import("./xchat-composer-panel").then((m) => ({ default: m.XchatComposerPanel })),
  { ssr: false, loading: () => <XchatChatSkeleton variant="composer" /> }
);

type XchatPendingPasteImage = import("./xchat-composer-panel").XchatPendingPasteImage;
type XchatPastedTextBlock = import("./xchat-composer-panel").XchatPastedTextBlock;

const GLOBAL_ADMIN_DEFAULT_PERSONA_PICKER_BLOCK = new Set(
  XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS.map((k) => k.toLowerCase())
);

type AskToolCallSummary = {
  name: string;
  durationMs: number;
};

type XchatPrivacyPrefs = {
  keepLastTenMessages: boolean;
  enableLongTermXaiMemory: boolean;
  consentedAt: string | null;
  xaiMemoryConsentedAt: string | null;
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
  /** When true, advisor compliance attestation locks chat history retention on. */
  chatHistoryRetentionRequired?: boolean;
  /** Tenant display name for welcome copy (server: `core_tenants.name` via branding resolver). */
  tenantWorkspaceSessionLabel?: string | null;
  /** Server-seeded desk outlook for the active workspace portfolio. */
  initialOutlookDesk?: XchatInitialOutlookDesk | null;
  /** Tenant allowlist for workspace rail; pass from server so Resources and routes match policy without client race. */
  visiblePathPrefixes?: string[];
  /** Legal footer under the chat main column only (not full viewport width). */
  mainFooter?: ReactNode;
};

/** String = chip shows full text. `{ prompt }` = full text sent on click; chip uses single-line ellipsis in the list. */
const THIRTY_DAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const XCHAT_QUOTE_FRESHNESS_STORAGE_KEY = "xchat_quote_freshness_v1";

/** Collapsed thread UI: show only the last N chat rows until the user expands. */
const XCHAT_UI_VISIBLE_MESSAGE_CAP = 6;

const THREAD_MAIN_VIRTUAL_MIN = 18;

function createThreadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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
    const rag = it.contextReferenceCount;
    const tools = it.toolCallCount;
    const persistedMs = it.interactionGenerationMs;
    out.push({
      id: `hydrate-ai-${it.id}`,
      role: "ai",
      content: it.response,
      persona: undefined,
      timestamp: t,
      serverLogId: it.id,
      interactionMeta: {
        generationMs:
          typeof persistedMs === "number" && Number.isFinite(persistedMs) && persistedMs > 0
            ? Math.round(persistedMs)
            : 0,
        sources: {
          ragChunks: rag,
          toolInvocations: tools,
          personaCollections: 0,
          total: rag + tools
        }
      }
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
  chatHistoryRetentionRequired = false,
  visiblePathPrefixes,
  tenantWorkspaceSessionLabel = null,
  initialOutlookDesk = null,
  mainFooter = null
}: XchatConversationProps) {
  const initialComposerHandoffRef = useRef<ReturnType<typeof consumeXchatPendingComposerHandoff> | null>(null);
  if (!initialComposerHandoffRef.current) {
    initialComposerHandoffRef.current = consumeXchatPendingComposerHandoff();
  }
  const initialComposerHandoff = initialComposerHandoffRef.current;
  const router = useRouter();
  const liveSseEnabled =
    typeof serverBootstrap?.liveSseEnabled === "boolean"
      ? serverBootstrap.liveSseEnabled
      : XCHAT_LIVE_SSE_ENV_FALLBACK;
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
  const [, setSavedHistory] = useState<HistoryItem[]>(() => {
    if (!serverBootstrap?.keepLastTenMessages) {
      return [];
    }
    return filterRailHistoryItems(serverBootstrap.historyItemsNewestFirst as HistoryItem[], workspaceChatHistoryMax);
  });
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState(() => initialComposerHandoff.prompt);
  const [reasoningMode, setReasoningMode] = useState<XchatReasoningMode>("fast");
  const [quoteFreshness, setQuoteFreshness] = useState<"cached_first" | "live">("cached_first");
  const [pendingPasteImages, setPendingPasteImages] = useState<XchatPendingPasteImage[]>([]);
  const [pasteImageError, setPasteImageError] = useState<string | null>(null);
  /** Full original multi-line text from a substantial clipboard paste. The visible `input` holds a short marker while this is set (keeps composer height compact). */
  const [pastedTextBlock, setPastedTextBlock] = useState<XchatPastedTextBlock | null>(null);
  const [visionUseWorkspace, setVisionUseWorkspace] = useState(false);
  const [promptUsageRefreshKey, setPromptUsageRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activePersonaName, setActivePersonaName] = useState(defaultPublishedPersonaName);
  const [personaPickerRows, setPersonaPickerRows] = useState<
    Array<{ _id: string; name: string; model?: string; previewLine?: string }>
  >([]);
  const [lastTurnRouting, setLastTurnRouting] = useState<XchatComposerRailLastTurnRouting | undefined>(
    undefined
  );
  const [personaListError, setPersonaListError] = useState<string | null>(null);
  const [personaListFetched, setPersonaListFetched] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [suggestedPersonaId, setSuggestedPersonaId] = useState<string | null>(null);
  const [pendingPreferredPersonaName, setPendingPreferredPersonaName] = useState<string | null>(
    () => initialComposerHandoff.personaName
  );
  const [privacyPrefs, setPrivacyPrefs] = useState<XchatPrivacyPrefs | null>(() =>
    serverBootstrap
      ? {
          keepLastTenMessages: serverBootstrap.keepLastTenMessages,
          enableLongTermXaiMemory: serverBootstrap.enableLongTermXaiMemory,
          consentedAt: serverBootstrap.consentedAt,
          xaiMemoryConsentedAt: serverBootstrap.xaiMemoryConsentedAt
        }
      : null
  );
  const [privacyPrefsLoading, setPrivacyPrefsLoading] = useState(() => serverBootstrap == null);
  const [privacyPrefsSaving, setPrivacyPrefsSaving] = useState(false);
  const [privacyPrefsError, setPrivacyPrefsError] = useState<string | null>(null);
  const [historyDeleteBusy, setHistoryDeleteBusy] = useState(false);
  const [historyDeleteError, setHistoryDeleteError] = useState<string | null>(null);
  const [threadItems, setThreadItems] = useState<ThreadItem[]>([]);
  /** After send, hide the transcript for a minimal view; user expands to read the thread. */
  /** Default collapsed when a thread exists; expanded while `loading` so replies stay visible (branding). */
  const [threadUiCollapsed, setThreadUiCollapsed] = useState(true);
  /** When false, thread list shows only the last `XCHAT_UI_VISIBLE_MESSAGE_CAP` rows; expand keeps full history. */
  const [threadHistoryExpanded, setThreadHistoryExpanded] = useState(false);
  const [threadSystemBanner, setThreadSystemBanner] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState(() => {
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
    return createThreadId();
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const historyRailScrollRef = useRef<HTMLDivElement | null>(null);
  const mainChatScrollRef = useRef<HTMLDivElement | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const stickyLatestPromptRef = useRef<HTMLDivElement | null>(null);
  const threadHydrateStartedRef = useRef(false);
  const skipRailHistoryListFetchOnceRef = useRef(
    Boolean(
      serverBootstrap?.keepLastTenMessages === true &&
        (serverBootstrap.historyItemsNewestFirst?.length ?? 0) > 0
    )
  );
  const pendingComposerFromHandoffRef = useRef(Boolean(initialComposerHandoff.prompt.trim()));
  const composerHandoffPromptRef = useRef(initialComposerHandoff.prompt.trim());
  const userPickedPersonaRef = useRef(false);
  /** After "Stay in chat", re-fill composer with the prompt that triggered the strategy-job offer. */
  const strategyStayRestorePromptRef = useRef<string | null>(null);
  /** Seconds since current ask started (UI only; resets when loading ends). */
  /** Monotonic elapsed ms while `/api/xchat/ask` is in flight (100ms ticks for smooth trading-clock UI). */
  const [askElapsedMs, setAskElapsedMs] = useState(0);
  const [strategyJobLaunchBusy, setStrategyJobLaunchBusy] = useState(false);
  /** Aborts in-flight `fetch` to `/api/xchat/ask` or `/api/strategy-jobs` when the user clicks Stop. */
  const askAbortRef = useRef<AbortController | null>(null);
  const sendSubmittingRef = useRef(false);
  const hnwiV21SlugForNextAskRef = useRef<string | null>(null);

  const prevPersonaIdForReasoningHydrateRef = useRef("");
  const skipNextPersonaReasoningHydrateRef = useRef(false);
  const depthModeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [depthModeToast, setDepthModeToast] = useState<string | null>(null);

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
    return { userTurnCount: n, preview };
  }, [messages]);
  const hiddenEarlierMessageCount = useMemo(() => {
    if (threadHistoryExpanded || messages.length <= XCHAT_UI_VISIBLE_MESSAGE_CAP) {
      return 0;
    }
    return messages.length - XCHAT_UI_VISIBLE_MESSAGE_CAP;
  }, [messages.length, threadHistoryExpanded]);

  const visibleThreadMessages = useMemo(() => {
    if (threadHistoryExpanded || messages.length <= XCHAT_UI_VISIBLE_MESSAGE_CAP) {
      return messages;
    }
    return messages.slice(-XCHAT_UI_VISIBLE_MESSAGE_CAP);
  }, [messages, threadHistoryExpanded]);
  const threadMainVirtualize = !threadUiCollapsed && visibleThreadMessages.length >= THREAD_MAIN_VIRTUAL_MIN;
  const threadVirtualizer = useVirtualizer({
    count: visibleThreadMessages.length,
    getScrollElement: () => threadScrollRef.current,
    estimateSize: (index) => {
      const row = visibleThreadMessages[index];
      if (!row) {
        return 160;
      }
      if (row.role === "ai") {
        return 320;
      }
      if (row.role === "user") {
        return 140;
      }
      return 120;
    },
    overscan: 6
  });
  const anchorThreadViewportToLatestTurn = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      anchorXchatThreadViewportAfterTurn(
        {
          mainChatScrollEl: mainChatScrollRef.current,
          threadScrollEl: threadScrollRef.current,
          stickyLatestPromptEl: stickyLatestPromptRef.current,
          messagesEndEl: messagesEndRef.current,
          threadVirtualized: threadMainVirtualize,
          lastVisibleMessageIndex: Math.max(0, visibleThreadMessages.length - 1),
          scrollToVirtualIndex: (index, scrollBehavior) => {
            threadVirtualizer.scrollToIndex(index, { align: "start", behavior: scrollBehavior });
          }
        },
        behavior
      );
    },
    [threadMainVirtualize, threadVirtualizer, visibleThreadMessages.length]
  );

  const expandFullThreadHistory = useCallback(() => {
    setThreadHistoryExpanded(true);
    queueMicrotask(() => anchorThreadViewportToLatestTurn("smooth"));
  }, [anchorThreadViewportToLatestTurn]);

  const dismissThreadSystemBanner = useCallback(() => {
    setThreadSystemBanner(null);
  }, []);

  /** After assistant integration, keep Latest prompt chrome in primary viewport. */
  useEffect(() => {
    if (threadUiCollapsed || messages.length === 0 || loading) {
      return;
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== "ai") {
      return;
    }
    anchorThreadViewportToLatestTurn("smooth");
  }, [messages, loading, threadUiCollapsed, anchorThreadViewportToLatestTurn]);

  /**
   * Rich cards (Options Action Scan) can inflate after lazy chunk mount.
   * Re-anchor once layout settles so prompt/response stay paired above the composer.
   */
  useEffect(() => {
    if (threadUiCollapsed) {
      return;
    }
    const t1 = window.setTimeout(() => anchorThreadViewportToLatestTurn("smooth"), 140);
    const t2 = window.setTimeout(() => anchorThreadViewportToLatestTurn("smooth"), 420);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [messages.length, loading, threadUiCollapsed, anchorThreadViewportToLatestTurn]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("thread") !== activeThreadId) {
        url.searchParams.set("thread", activeThreadId);
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      /* ignore */
    }
  }, [activeThreadId]);

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

  const historyListVirtualize = threadItems.length > 14;
  const historyVirtualizer = useVirtualizer({
    count: threadItems.length,
    getScrollElement: () => historyRailScrollRef.current,
    estimateSize: () => 44,
    overscan: 8
  });
  const historyMode = historyStats?.historyMode ?? (privacyPrefs?.keepLastTenMessages ? "mongo" : "ephemeral");
  const isEphemeralHistoryMode = historyMode === "ephemeral";

  const hydrateThread = useCallback(
    async (threadId: string) => {
      const res = await fetch(`/api/xchat/history?threadId=${encodeURIComponent(threadId)}&limit=${uiPromptLimit}`);
      if (!res.ok) {
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { items?: HistoryItem[] };
      };
      const items = payload.data?.items ?? [];
      const thread = historyItemsToTranscriptMessages(items);
      const { next } = trimTranscriptToRecentPrompts(thread, uiPromptLimit);
      setMessages(next);
      setSavedHistory(items);
      setActiveThreadId(threadId);
      setInput("");
      setStrategyJobOptOut(false);
      setThreadHistoryExpanded(false);
      setThreadUiCollapsed(false);
      expandWorkspaceProductRail();
      queueMicrotask(() => {
        anchorThreadViewportToLatestTurn("smooth");
        composerRef.current?.focus();
      });
    },
    [anchorThreadViewportToLatestTurn, uiPromptLimit]
  );

  const refreshThreadItems = useCallback(async () => {
    const res = await fetch(`/api/xchat/threads?limit=${Math.max(20, uiPromptLimit * 3)}`);
    if (!res.ok) {
      return;
    }
    const payload = (await res.json().catch(() => ({}))) as {
      data?: { items?: ThreadItem[] };
    };
    setThreadItems(payload.data?.items ?? []);
  }, [uiPromptLimit]);

  const startNewThread = useCallback(() => {
    const nextThreadId = createThreadId();
    setActiveThreadId(nextThreadId);
    setMessages([]);
    setSavedHistory([]);
    setInput("");
    setStrategyJobOptOut(false);
    setThreadHistoryExpanded(false);
    setThreadUiCollapsed(false);
    setReasoningMode("fast");
    queueMicrotask(() => composerRef.current?.focus());
  }, []);

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

  const reasoningStorageKeyForPersona = useCallback((personaId: string) => {
    const id = personaId.trim();
    return id.length > 0 ? `${XCHAT_REASONING_MODE_STORAGE_KEY}:${id}` : null;
  }, []);

  const clearDepthModeToastSoon = useCallback((msg: string) => {
    if (depthModeToastTimerRef.current != null) {
      clearTimeout(depthModeToastTimerRef.current);
    }
    setDepthModeToast(msg);
    depthModeToastTimerRef.current = setTimeout(() => {
      setDepthModeToast(null);
      depthModeToastTimerRef.current = null;
    }, 4200);
  }, []);

  const applyReasoningModeChange = useCallback(
    (next: XchatReasoningMode) => {
      if (next === "heavy" && !personaPickerLocked && personaSelectRows.length > 0) {
        const advisorRow = personaSelectRows.find((p) => p.name.trim().toLowerCase() === "advisor");
        const currentRow = personaSelectRows.find((p) => p._id === selectedPersonaId.trim());
        const curName = currentRow?.name.trim().toLowerCase() ?? "";
        if (curName !== XPERSONA_NAME_QUANT_TRADER && advisorRow && curName !== "advisor") {
          skipNextPersonaReasoningHydrateRef.current = true;
          userPickedPersonaRef.current = true;
          setSelectedPersonaId(advisorRow._id);
          clearDepthModeToastSoon("Switched to Deep Research Mode — Advisor persona for Heavy depth.");
        }
      }
      setReasoningMode(next);
    },
    [clearDepthModeToastSoon, personaPickerLocked, personaSelectRows, selectedPersonaId]
  );

  useEffect(
    () => () => {
      if (depthModeToastTimerRef.current != null) {
        clearTimeout(depthModeToastTimerRef.current);
      }
    },
    []
  );
  const selectedPersonaModel = useMemo(() => {
    const id = selectedPersonaId.trim();
    if (!id) {
      return undefined;
    }
    return personaPickerRows.find((row) => row._id === id)?.model?.trim();
  }, [personaPickerRows, selectedPersonaId]);

  const resizeComposer = useCallback(() => {
    const el = composerRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, getXchatComposerTextareaMaxPx())}px`;
  }, []);

  const priorComposerContextRef = useRef<{
    personaId: string;
    reasoningMode: XchatReasoningMode;
    workspacePortfolioId: string;
  } | null>(null);

  useEffect(() => {
    if (loading || sendSubmittingRef.current) {
      return;
    }
    const nextContext = {
      personaId: selectedPersonaId.trim(),
      reasoningMode,
      workspacePortfolioId: workspacePortfolioId?.trim() ?? ""
    };
    const priorContext = priorComposerContextRef.current;
    priorComposerContextRef.current = nextContext;
    if (!priorContext) {
      return;
    }
    const contextChanged =
      priorContext.personaId !== nextContext.personaId ||
      priorContext.reasoningMode !== nextContext.reasoningMode ||
      priorContext.workspacePortfolioId !== nextContext.workspacePortfolioId;
    if (!contextChanged) {
      return;
    }
    const protectedHandoffPrompt = composerHandoffPromptRef.current;
    if (protectedHandoffPrompt && input.trim() === protectedHandoffPrompt) {
      return;
    }
    clearXchatComposerDraft(setInput, composerRef.current, resizeComposer);
  }, [input, loading, reasoningMode, resizeComposer, selectedPersonaId, workspacePortfolioId]);

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
          enableLongTermXaiMemory: payload.data?.enableLongTermXaiMemory === true,
          consentedAt: payload.data?.consentedAt ?? null,
          xaiMemoryConsentedAt: payload.data?.xaiMemoryConsentedAt ?? null
        };
        setPrivacyPrefs(next);
      } catch (error) {
        if (!active) {
          return;
        }
        setPrivacyPrefs({
          keepLastTenMessages: false,
          enableLongTermXaiMemory: false,
          consentedAt: null,
          xaiMemoryConsentedAt: null
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
    queueMicrotask(() => anchorThreadViewportToLatestTurn("smooth"));
  }, [activeThreadId, anchorThreadViewportToLatestTurn]);

  const askProgressPhaseIndex = useMemo(() => {
    if (!loading) {
      return -1;
    }
    return Math.min(3, Math.floor(askElapsedMs / 950));
  }, [loading, askElapsedMs]);

  const persistQuoteFreshness = useCallback((next: "cached_first" | "live") => {
    setQuoteFreshness(next);
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(XCHAT_QUOTE_FRESHNESS_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

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
    if (typeof window === "undefined") {
      return;
    }
    try {
      const v = window.localStorage.getItem(XCHAT_QUOTE_FRESHNESS_STORAGE_KEY);
      if (v === "cached_first" || v === "live") {
        setQuoteFreshness(v);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const pid = workspacePortfolioId?.trim();
    if (!pid || typeof window === "undefined") {
      return;
    }
    const ac = new AbortController();
    const warmUrl = new URL("/api/xchat/workspace-warm", window.location.origin);
    warmUrl.searchParams.set("portfolioId", pid);
    void fetch(warmUrl.toString(), { credentials: "include", signal: ac.signal }).catch(() => {});
    const bootstrapUrl = new URL("/api/app-user/find-options/bootstrap", window.location.origin);
    bootstrapUrl.searchParams.set("holdingsLimit", "10");
    bootstrapUrl.searchParams.set("hotLimit", "3");
    const aid = requestedWorkspaceAccountId?.trim();
    if (aid) {
      bootstrapUrl.searchParams.set("accountId", aid);
    }
    void fetch(bootstrapUrl.toString(), { credentials: "include", signal: ac.signal }).catch(() => {});
    return () => ac.abort();
  }, [workspacePortfolioId, requestedWorkspaceAccountId]);

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
        const res = await fetch(
          `/api/xchat/history?threadId=${encodeURIComponent(activeThreadId)}&limit=${uiPromptLimit}`
        );
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
        setSavedHistory(items);
        setMessages((prev) => (prev.length > 0 ? prev : thread));
      } catch {
        // non-fatal: empty thread until first send
      }
    }
    void hydrateThreadFromHistory();
    return () => {
      active = false;
    };
  }, [activeThreadId, privacyPrefs?.keepLastTenMessages, privacyPrefsLoading, serverBootstrap, uiPromptLimit]);

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
          data?: Array<{ _id?: string; name?: string; model?: string; systemPrompt?: string }>;
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
            const model = String(r.model ?? "").trim();
            return {
              _id: String(r._id ?? "").trim(),
              name: String(r.name ?? "").trim(),
              ...(model ? { model } : {}),
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
          setThreadItems([]);
          setSavedHistory([]);
          setHistoryLoaded(true);
          return;
        }
        const threadsRes = await fetch(`/api/xchat/threads?limit=${Math.max(20, uiPromptLimit * 3)}`);
        const threadsPayload = (await threadsRes.json().catch(() => ({}))) as {
          data?: { items?: ThreadItem[] };
          error?: string;
        };
        if (!threadsRes.ok) {
          throw new Error(threadsPayload.error ?? `Threads request failed (${threadsRes.status})`);
        }
        if (!active) {
          return;
        }
        const items = (threadsPayload.data?.items ?? []).slice(0, workspaceChatHistoryMax * 3);
        setThreadItems(items);

        if (skipRailHistoryListFetchOnceRef.current) {
          skipRailHistoryListFetchOnceRef.current = false;
          setHistoryLoaded(true);
          return;
        }

        const initialThreadId = activeThreadId || items[0]?.threadId;
        if (initialThreadId) {
          await hydrateThread(initialThreadId);
        } else {
          setSavedHistory([]);
          setMessages([]);
        }
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
  }, [
    activeThreadId,
    historyLoaded,
    hydrateThread,
    privacyPrefs?.keepLastTenMessages,
    privacyPrefsLoading,
    uiPromptLimit,
    workspaceChatHistoryMax
  ]);

  useEffect(() => {
    const id = selectedPersonaId.trim();
    if (!personaListFetched || id.length === 0) {
      return;
    }
    if (prevPersonaIdForReasoningHydrateRef.current === id) {
      return;
    }
    if (skipNextPersonaReasoningHydrateRef.current) {
      skipNextPersonaReasoningHydrateRef.current = false;
      prevPersonaIdForReasoningHydrateRef.current = id;
      return;
    }
    const row = personaPickerRows.find((p) => p._id === id);
    const personaNameNorm = row?.name.trim().toLowerCase() ?? "";
    const forcedMode = shouldForceReasoningModeForPersona(personaNameNorm);
    if (forcedMode) {
      setReasoningMode(forcedMode);
      if (personaNameNorm === XPERSONA_NAME_QUANT_TRADER) {
        clearDepthModeToastSoon("Quant Trader uses Heavy depth for Monte Carlo and multi-agent quant runs.");
      }
      prevPersonaIdForReasoningHydrateRef.current = id;
      return;
    }
    const personaDefault = personaDefaultReasoningMode(personaNameNorm);
    const key = reasoningStorageKeyForPersona(id);
    if (!key) {
      return;
    }
    try {
      let raw = localStorage.getItem(key);
      if (raw == null && personaDefault == null) {
        const legacy = localStorage.getItem(XCHAT_REASONING_MODE_STORAGE_KEY);
        if (legacy === "fast" || legacy === "expert" || legacy === "heavy") {
          raw = legacy;
          localStorage.setItem(key, legacy);
        }
      }
      if (raw === "fast" || raw === "expert" || raw === "heavy") {
        setReasoningMode(raw);
      } else if (personaDefault) {
        setReasoningMode(personaDefault);
      }
    } catch {
      /* ignore */
    }
    prevPersonaIdForReasoningHydrateRef.current = id;
  }, [
    clearDepthModeToastSoon,
    personaListFetched,
    personaPickerRows,
    reasoningStorageKeyForPersona,
    selectedPersonaId
  ]);

  useEffect(() => {
    const key = reasoningStorageKeyForPersona(selectedPersonaId);
    if (!key) {
      return;
    }
    try {
      localStorage.setItem(key, reasoningMode);
    } catch {
      /* ignore */
    }
  }, [reasoningMode, reasoningStorageKeyForPersona, selectedPersonaId]);

  useEffect(() => {
    const focusComposer = () => {
      queueMicrotask(() => {
        const el = composerRef.current;
        if (!el) {
          return;
        }
        el.focus();
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, getXchatComposerTextareaMaxPx())}px`;
      });
    };

    if (!initialXchatItem || initialXchatItem === "composer" || initialXchatItem === "persona") {
      collapseWorkspaceProductRail();
      if (initialXchatItem === "composer" || initialXchatItem === "persona") {
        focusComposer();
      }
      return;
    }

    expandWorkspaceProductRail();
  }, [initialXchatItem]);

  const setKeepLastTenMessages = useCallback(async (enabled: boolean) => {
    setPrivacyPrefsSaving(true);
    setPrivacyPrefsError(null);
    try {
      const response = await fetch("/api/xchat/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          keepLastTenMessages: enabled,
          enableLongTermXaiMemory: enabled ? (privacyPrefs?.enableLongTermXaiMemory ?? false) : false
        })
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
        enableLongTermXaiMemory: payload.data?.enableLongTermXaiMemory === true,
        consentedAt: payload.data?.consentedAt ?? null,
        xaiMemoryConsentedAt: payload.data?.xaiMemoryConsentedAt ?? null
      });
    } catch (error) {
      setPrivacyPrefsError(error instanceof Error ? error.message : "Failed to update privacy setting");
    } finally {
      setPrivacyPrefsSaving(false);
    }
  }, [privacyPrefs?.enableLongTermXaiMemory]);

  const setEnableLongTermXaiMemory = useCallback(async (enabled: boolean) => {
    if (!privacyPrefs?.keepLastTenMessages) {
      return;
    }
    setPrivacyPrefsSaving(true);
    setPrivacyPrefsError(null);
    try {
      const response = await fetch("/api/xchat/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          keepLastTenMessages: true,
          enableLongTermXaiMemory: enabled
        })
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
        enableLongTermXaiMemory: payload.data?.enableLongTermXaiMemory === true,
        consentedAt: payload.data?.consentedAt ?? null,
        xaiMemoryConsentedAt: payload.data?.xaiMemoryConsentedAt ?? null
      });
    } catch (error) {
      setPrivacyPrefsError(error instanceof Error ? error.message : "Failed to update privacy setting");
    } finally {
      setPrivacyPrefsSaving(false);
    }
  }, [privacyPrefs?.keepLastTenMessages]);

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
      setThreadItems([]);
      setMessages([]);
      setActiveThreadId(createThreadId());
      setThreadHistoryExpanded(false);
      setStrategyJobOptOut(false);
      setReasoningMode("fast");
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
    const pastedImages = pendingPasteImages;
    const hasPasteImage = pastedImages.length > 0;

    // Resolve the actual message to send: prefer the original pasted block (full text) when present.
    // The visible `input` may only contain the short marker for UI compactness.
    let prompt = input.trim();
    if (pastedTextBlock && pastedTextBlock.text.trim()) {
      prompt = pastedTextBlock.text.trim();
    }
    if ((!prompt && !hasPasteImage) || loading || sendSubmittingRef.current) return;
    sendSubmittingRef.current = true;

    if (!shouldStayInChatFromReply(prompt)) {
      strategyStayRestorePromptRef.current = null;
    }

    // Keep thread expanded while a response is in flight so users can read it immediately.
    setThreadUiCollapsed(false);
    setThreadSystemBanner(null);
    // Collapse older turns behind "Previous turns" so latest prompt/response stay together.
    setThreadHistoryExpanded(false);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      ...(pastedImages[0] ? { attachmentPreviewUrl: pastedImages[0].previewUrl } : {}),
      timestamp: Date.now()
    };
    const pairedUserPromptForTurn =
      hasPasteImage && !prompt
        ? pastedImages.length > 1
          ? `[Pasted ${pastedImages.length} images]`
          : "[Pasted image]"
        : prompt;
    const nextStrategyOptOut = strategyJobOptOut || shouldStayInChatFromReply(prompt);
    if (nextStrategyOptOut !== strategyJobOptOut) {
      setStrategyJobOptOut(nextStrategyOptOut);
    }

    setMessages((prev) => {
      const added = [...prev, userMsg];
      const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
      return next;
    });
    clearXchatComposerDraft(setInput, composerRef.current, resizeComposer, { blur: true });
    composerHandoffPromptRef.current = "";
    clearXchatPendingComposerHandoffMemory();
    queueMicrotask(() => anchorThreadViewportToLatestTurn("smooth"));
    setLoading(true);
    const askController = new AbortController();
    askAbortRef.current = askController;
    const askSignal = askController.signal;
    if (hasPasteImage) {
      setPendingPasteImages([]);
      setPasteImageError(null);
      setVisionUseWorkspace(false);
    }
    if (pastedTextBlock) {
      setPastedTextBlock(null);
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
        sendSubmittingRef.current = false;
        setStrategyJobLaunchBusy(false);
        setLoading(false);
      }
    }

    try {
      const hnwiSlugForTurnRaw = hnwiV21SlugForNextAskRef.current;
      hnwiV21SlugForNextAskRef.current = null;
      const hnwiSlugForTurn =
        hnwiSlugForTurnRaw && isHnwiPromptTemplateV21Slug(hnwiSlugForTurnRaw) ? hnwiSlugForTurnRaw : null;

      const askBody: {
        message: string;
        imageAttachment?: { mediaType: XchatPendingPasteImage["mediaType"]; dataBase64: string };
        imageAttachments?: Array<{ mediaType: XchatPendingPasteImage["mediaType"]; dataBase64: string }>;
        visionUseWorkspace?: boolean;
        scope: string;
        threadId: string;
        strategyJobOptOut: boolean;
        recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
        portfolioId?: string;
        personaId?: string;
        reasoningMode?: XchatReasoningMode;
        quoteFreshness: "cached_first" | "live";
        hnwiPromptTemplateV21Slug?: string;
      } = {
        message: prompt,
        scope: "global",
        threadId: activeThreadId,
        strategyJobOptOut: nextStrategyOptOut,
        recentMessages: buildAskRecentMessages(messages, 10),
        quoteFreshness
      };
      if (hasPasteImage && pastedImages.length > 0) {
        askBody.imageAttachments = pastedImages.map((img) => ({
          mediaType: img.mediaType,
          dataBase64: img.dataBase64
        }));
      }
      if (visionUseWorkspace && hasPasteImage) {
        askBody.visionUseWorkspace = true;
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
      if (hnwiSlugForTurn) {
        askBody.hnwiPromptTemplateV21Slug = hnwiSlugForTurn;
      }

      type AskPayload = {
        data?: {
          content?: string;
          response: string;
          personaName?: string;
          logId?: string;
          toolCalls?: AskToolCallSummary[];
          strategyJobOffer?: boolean;
          optionsActionScan?: OptionsActionScanDisplayData;
          model?: string;
          modelSelectionSource?: string;
          contextSource?: string;
          contextCount?: number;
          collectionSearchStatus?: string;
          collectionSearchNonReadyFileCount?: number;
          xaiUsage?: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            reasoningTokens?: number;
            cachedPromptTokens?: number;
          };
          interactionMeta?: XchatInteractionMeta;
          contextRetainedFromPriorTurns?: boolean;
          metadata?: {
            threadId?: string;
          };
        };
        error?: string;
        code?: string;
        dailyLimit?: number;
        hourlyLimit?: number;
        xchatLimitSource?: "tenant_plan_effective" | "per_minute_burst";
        retryAfterSeconds?: number;
        resetAt?: string;
        contactAdmin?: boolean;
        correlationId?: string;
        redirectPath?: string;
        message?: string;
      };

      const handleAskFailure = (response: Response, payload: AskPayload) => {
        setPromptUsageRefreshKey((k) => k + 1);
        if (payload.code === "advisor_compliance_required") {
          router.push(advisorComplianceWorkspaceRedirectPath("xchat"));
          return;
        }
        if (isXchatUsageLimitCode(payload.code)) {
          setThreadSystemBanner(
            buildXchatAskLimitBannerMarkdown({
              code: payload.code,
              error: payload.error,
              dailyLimit: payload.dailyLimit,
              hourlyLimit: payload.hourlyLimit,
              retryAfterSeconds: payload.retryAfterSeconds,
              resetAt: payload.resetAt,
              contactAdmin: payload.contactAdmin,
              responseStatus: response.status
            })
          );
          setThreadUiCollapsed(false);
        } else {
          const base = payload.error ?? `Request failed (${response.status})`;
          setMessages((prev) => {
            const added = [
              ...prev,
              {
                id: `error-${Date.now()}`,
                role: "error" as const,
                content: base,
                timestamp: Date.now()
              }
            ];
            const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
            return next;
          });
        }
        if (strategyStayRestorePromptRef.current && shouldStayInChatFromReply(prompt)) {
          setInput(strategyStayRestorePromptRef.current);
          strategyStayRestorePromptRef.current = null;
        }
      };

      const handleAskSuccess = (data: NonNullable<AskPayload["data"]>) => {
        setLastTurnRouting(xchatAskDataToComposerRailLastTurn(data));
        const resolvedName = data.personaName ?? activePersonaName;
        setActivePersonaName(resolvedName);
        const effectiveThreadId = data.metadata?.threadId?.trim() || activeThreadId;
        setActiveThreadId(effectiveThreadId);

        const logId = typeof data.logId === "string" ? data.logId : undefined;
        const historyItemId = logId || `local-${Date.now()}`;
        setMessages((prev) => {
          const added = [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: "ai" as const,
              content: data.content ?? data.response ?? "",
              persona: resolvedName,
              timestamp: Date.now(),
              serverLogId: logId,
              strategyJobOffer: Boolean(data.strategyJobOffer),
              optionsActionScan: data.optionsActionScan,
              interactionMeta: data.interactionMeta,
              contextRetainedFromPriorTurns: data.contextRetainedFromPriorTurns === true,
              pairedUserPrompt: pairedUserPromptForTurn
            }
          ];
          const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
          return next;
        });
        setSavedHistory((prev) => {
          const nextItem: HistoryItem = {
            id: historyItemId,
            threadId: effectiveThreadId,
            message: hasPasteImage && !prompt ? "[Pasted image]" : prompt,
            response: data.content ?? data.response ?? "",
            model: "xchat",
            createdAt: new Date().toISOString(),
            personaId: personaIdSent,
            contextReferenceCount: 0,
            toolCallCount: data.toolCalls?.length ?? 0
          };
          const deduped = prev.filter((item) => item.id !== nextItem.id);
          return [nextItem, ...deduped].slice(0, uiPromptLimit);
        });
        void refreshThreadItems();
        setPromptUsageRefreshKey((k) => k + 1);
        if (strategyStayRestorePromptRef.current && shouldStayInChatFromReply(prompt)) {
          setInput(strategyStayRestorePromptRef.current);
          strategyStayRestorePromptRef.current = null;
        }
      };

      if (liveSseEnabled) {
        let streamRes: Response;
        try {
          streamRes = await fetch("/api/xchat/ask/stream", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream"
            },
            body: JSON.stringify(askBody),
            signal: askSignal
          });
        } catch {
          await new Promise((r) => setTimeout(r, 750));
          if (askSignal.aborted) {
            return;
          }
          streamRes = await fetch("/api/xchat/ask/stream", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream"
            },
            body: JSON.stringify(askBody),
            signal: askSignal
          });
        }

        const ct = streamRes.headers.get("content-type") ?? "";
        if (streamRes.ok && ct.includes("text/event-stream")) {
          const aiId = `ai-${Date.now()}`;
          setMessages((prev) => {
            const added = [
              ...prev,
              {
                id: aiId,
                role: "ai" as const,
                content: "",
                persona: activePersonaName,
                timestamp: Date.now(),
                liveToolStatuses: [],
                pairedUserPrompt: pairedUserPromptForTurn
              }
            ];
            const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
            return next;
          });

          let accumulated = "";
          let lastActivity = Date.now();
          let stallWatch: number | undefined;
          try {
            stallWatch = window.setInterval(() => {
              if (Date.now() - lastActivity > 90_000) {
                askController.abort();
              }
            }, 4000) as unknown as number;

            const sseOutcome = await consumeXchatAskSseResponse(
              streamRes,
              {
              onPing: () => {
                lastActivity = Date.now();
              },
              onDelta: (chunk) => {
                lastActivity = Date.now();
                accumulated += chunk;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aiId ? { ...m, content: accumulated } : m))
                );
              },
              onToolStatus: (st) => {
                lastActivity = Date.now();
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiId
                      ? {
                          ...m,
                          liveToolStatuses: mergeLiveToolStatusRow(m.liveToolStatuses ?? [], st)
                        }
                      : m
                  )
                );
              },
              onDone: (done) => {
                lastActivity = Date.now();
                const data = done as NonNullable<AskPayload["data"]>;
                setLastTurnRouting(xchatAskDataToComposerRailLastTurn(data));
                const finalText =
                  typeof data.content === "string"
                    ? data.content
                    : typeof data.response === "string"
                      ? data.response
                      : accumulated;
                const resolvedName = data.personaName ?? activePersonaName;
                setActivePersonaName(resolvedName);
                const effectiveThreadId = data.metadata?.threadId?.trim() || activeThreadId;
                setActiveThreadId(effectiveThreadId);
                const logId = typeof data.logId === "string" ? data.logId : undefined;
                const historyItemId = logId || `local-${Date.now()}`;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiId
                      ? {
                          ...m,
                          content: finalText,
                          persona: resolvedName,
                          serverLogId: logId,
                          strategyJobOffer: Boolean(data.strategyJobOffer),
                          optionsActionScan: data.optionsActionScan,
                          interactionMeta: data.interactionMeta,
                          contextRetainedFromPriorTurns: data.contextRetainedFromPriorTurns === true,
                          liveToolStatuses: undefined,
                          pairedUserPrompt: pairedUserPromptForTurn
                        }
                      : m
                  )
                );
                setSavedHistory((prev) => {
                  const nextItem: HistoryItem = {
                    id: historyItemId,
                    threadId: effectiveThreadId,
                    message: hasPasteImage && !prompt ? "[Pasted image]" : prompt,
                    response: finalText,
                    model: "xchat",
                    createdAt: new Date().toISOString(),
                    personaId: personaIdSent,
                    contextReferenceCount: 0,
                    toolCallCount: Array.isArray(data.toolCalls) ? data.toolCalls.length : 0
                  };
                  const deduped = prev.filter((item) => item.id !== nextItem.id);
                  return [nextItem, ...deduped].slice(0, uiPromptLimit);
                });
                void refreshThreadItems();
                setPromptUsageRefreshKey((k) => k + 1);
                if (strategyStayRestorePromptRef.current && shouldStayInChatFromReply(prompt)) {
                  setInput(strategyStayRestorePromptRef.current);
                  strategyStayRestorePromptRef.current = null;
                }
              },
              onError: ({ message, code }) => {
                lastActivity = Date.now();
                setMessages((prev) => {
                  const cleaned = prev.filter((m) => m.id !== aiId);
                  if (code === "request_aborted") {
                    const { next } = trimTranscriptToRecentPrompts(cleaned, uiPromptLimit);
                    return next;
                  }
                  return cleaned;
                });
                if (code !== "request_aborted") {
                  if (isXchatUsageLimitCode(code)) {
                    setThreadSystemBanner(
                      buildXchatAskLimitBannerMarkdown({
                        code,
                        error: message,
                        contactAdmin: true
                      })
                    );
                    setThreadUiCollapsed(false);
                  } else {
                    setMessages((prev) => {
                      const added = [
                        ...prev,
                        {
                          id: `error-${Date.now()}`,
                          role: "error" as const,
                          content: message,
                          timestamp: Date.now()
                        }
                      ];
                      const { next } = trimTranscriptToRecentPrompts(added, uiPromptLimit);
                      return next;
                    });
                  }
                }
                if (strategyStayRestorePromptRef.current && shouldStayInChatFromReply(prompt)) {
                  setInput(strategyStayRestorePromptRef.current);
                  strategyStayRestorePromptRef.current = null;
                }
              }
            },
            { signal: askSignal }
          );

            if (!sseOutcome.ok) {
              setMessages((prev) => {
                const cleaned = prev.filter((m) => m.id !== aiId);
                const { next } = trimTranscriptToRecentPrompts(cleaned, uiPromptLimit);
                return next;
              });
              return;
            }
            return;
          } finally {
            if (stallWatch) {
              window.clearInterval(stallWatch);
            }
          }
        }

        const payload = (await streamRes.json().catch(() => ({}))) as AskPayload;
        if (!streamRes.ok || !payload.data) {
          handleAskFailure(streamRes, payload);
          return;
        }
        handleAskSuccess(payload.data);
        return;
      }

      const response = await fetch("/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(askBody),
        signal: askSignal
      });

      const payload = (await response.json().catch(() => ({}))) as AskPayload;

      if (!response.ok || !payload.data) {
        handleAskFailure(response, payload);
        return;
      }

      handleAskSuccess(payload.data);
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
      sendSubmittingRef.current = false;
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
                            el.style.height = `${Math.min(el.scrollHeight, getXchatComposerTextareaMaxPx())}px`;
                          }
                        });
                      }}
                    >
                      Focus composer
                    </button>
                    <XchatComposerRailRouting
                      lastTurn={lastTurnRouting}
                      personaModel={selectedPersonaModel}
                      personaName={activePersonaName}
                      reasoningMode={reasoningMode}
                    />
                    <XchatUsageStatusRow refreshSignal={promptUsageRefreshKey} variant="rail" />
                  </RailDisclosure>
                </div>

                <div className="xchat-rail-subsection">
                  <RailDisclosure
                    defaultOpen={initialXchatItem === "history"}
                    icon={<ChatHistoryRailIcon className="app-user-rail-disclosure__glyph" />}
                    title="Chat history"
                  >
                    <div className="xchat-sidebar-privacy-row">
                      <span className="xchat-sidebar-privacy-row__label">
                        Keep last 10 messages (60-day retention, encrypted at rest). You can delete anytime.
                      </span>
                      <label
                        className="xchat-sidebar-privacy-row__control"
                        aria-label="Keep last 10 messages with 60-day retention"
                      >
                        <input
                          checked={privacyPrefs?.keepLastTenMessages === true}
                          disabled={
                            privacyPrefsLoading ||
                            privacyPrefsSaving ||
                            chatHistoryRetentionRequired
                          }
                          onChange={(e) => {
                            void setKeepLastTenMessages(e.target.checked);
                          }}
                          type="checkbox"
                        />
                      </label>
                    </div>
                    {chatHistoryRetentionRequired ? (
                      <p className="status-text text-xs text-[var(--xf-gain-green)]">
                        Required while compliance attestation is on your record (stored for audit/export).
                      </p>
                    ) : null}
                    {privacyPrefs?.keepLastTenMessages === true ? (
                      <div className="xchat-sidebar-privacy-row">
                        <span className="xchat-sidebar-privacy-row__label">
                          Enable long-term xAI memory for personalized strategy continuity?
                        </span>
                        <label
                          className="xchat-sidebar-privacy-row__control"
                          aria-label="Enable long-term xAI memory for personalized strategy continuity"
                        >
                          <input
                            checked={privacyPrefs?.enableLongTermXaiMemory === true}
                            disabled={privacyPrefsLoading || privacyPrefsSaving}
                            onChange={(e) => {
                              void setEnableLongTermXaiMemory(e.target.checked);
                            }}
                            type="checkbox"
                          />
                        </label>
                      </div>
                    ) : null}
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
                    {!isEphemeralHistoryMode && !historyLoading && !historyError && threadItems.length === 0 ? (
                      <p className="status-text">No threads yet.</p>
                    ) : null}
                    {!isEphemeralHistoryMode && !historyLoading && !historyError && threadItems.length > 0 ? (
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
                              const item = threadItems[vi.index]!;
                              return (
                                <div
                                  key={item.threadId}
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
                                  <XfHoverHint hint={item.lastMessage}>
                                    <button
                                      className="app-user-rail-sublink xchat-rail-link xchat-rail-link--history"
                                      type="button"
                                      onClick={() => {
                                        void hydrateThread(item.threadId);
                                      }}
                                    >
                                      <span className="xchat-rail-link__text">{item.title}</span>
                                    </button>
                                  </XfHoverHint>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <ul className="xchat-rail-history-list">
                          {threadItems.map((item) => (
                            <li className="xchat-rail-history-item" key={item.threadId}>
                              <XfHoverHint hint={item.lastMessage}>
                                <button
                                  className="app-user-rail-sublink xchat-rail-link xchat-rail-link--history"
                                  type="button"
                                  onClick={() => {
                                    void hydrateThread(item.threadId);
                                  }}
                                >
                                  <span className="xchat-rail-link__text">{item.title}</span>
                                </button>
                              </XfHoverHint>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : null}
                    <button
                      className="app-user-rail-sublink xchat-rail-link xchat-rail-link--history"
                      type="button"
                      onClick={startNewThread}
                    >
                      New thread
                    </button>
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
        <div ref={mainChatScrollRef} className="xchat-main__chat-scroll">
          <header className="xchat-welcome-header xchat-welcome-header--compact">
            <div className="xchat-welcome-header__row">
              <div className="xchat-welcome-header__lead">
                <h1 className="xchat-welcome-title">Welcome, {welcomeName}!</h1>
                {tenantWorkspaceSessionLabel ? (
                  <p className="xchat-welcome-tenant font-medium text-[var(--xf-text-200)]">
                    · {tenantWorkspaceSessionLabel}
                  </p>
                ) : null}
              </div>
              <XchatOutlookFreshnessBadge
                inline
                initialOutlookDesk={initialOutlookDesk}
                workspaceBook={workspaceBook}
                workspacePortfolioId={workspacePortfolioId}
              />
              <XchatUsageMeter
                variant="header"
                refreshSignal={promptUsageRefreshKey}
              />
            </div>
            <p className="xchat-welcome-sub">
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

          <Suspense fallback={<XchatChatSkeleton variant="thread" />}>
            <XchatThreadPanelLazy
              activePersonaName={activePersonaName}
              emphasizeStrategyJobPrimary={emphasizeStrategyForMessage}
              loading={loading}
              messages={messages}
              onMessageFeedback={handleMessageFeedback}
              onRegeneratePrompt={handleRegeneratePrompt}
              onNewThread={startNewThread}
              hiddenEarlierMessageCount={hiddenEarlierMessageCount}
              onExpandEarlierMessages={expandFullThreadHistory}
              onDismissThreadSystemBanner={dismissThreadSystemBanner}
              threadSystemBanner={threadSystemBanner}
              messagesEndRef={messagesEndRef}
              onStrategyJobLaunch={onStrategyJobLaunch}
              onStrategyJobStay={onStrategyJobStay}
              setThreadUiCollapsed={setThreadUiCollapsed}
              strategyJobLaunchBusy={strategyJobLaunchBusy}
              threadId={activeThreadId}
              threadMainVirtualize={threadMainVirtualize}
              stickyLatestPromptRef={stickyLatestPromptRef}
              threadScrollRef={threadScrollRef}
              threadUiCollapsed={threadUiCollapsed}
              threadUiSummary={threadUiSummary}
              threadVirtualizer={threadVirtualizer}
              visibleThreadMessages={visibleThreadMessages}
              workspacePortfolioId={workspacePortfolioId?.trim() ? workspacePortfolioId.trim() : null}
            />
          </Suspense>
        </div>

        <XchatAdvisorWorkingOverlay
          askElapsedMs={askElapsedMs}
          askProgressPhaseIndex={askProgressPhaseIndex}
          loading={loading}
          onStop={cancelAskInFlight}
        />

        {/* Usage % now lives in the top welcome header row next to the portfolio outlook (see below).
            The rail variant in the left sidebar is unchanged. */}
        {privacyPrefs?.enableLongTermXaiMemory === true ? (
          <p className="status-text xchat-long-term-memory-banner" role="status">
            Personalized strategy memory enabled — history will be included in all tool calls.
          </p>
        ) : null}
        <Suspense fallback={<XchatChatSkeleton variant="composer" />}>
          <XchatComposerPanelLazy
            askProgressPhaseIndex={askProgressPhaseIndex}
            composerFormRef={composerFormRef}
            composerRef={composerRef}
            templatesGalleryInitiallyExpanded={initialXchatItem === "examples"}
            depthModeToast={depthModeToast}
            handleSend={handleSend}
            input={input}
            loading={loading}
            onCancelAsk={cancelAskInFlight}
            onQuoteFreshnessChange={persistQuoteFreshness}
            pasteImageError={pasteImageError}
            pendingPasteImages={pendingPasteImages}
            pastedTextBlock={pastedTextBlock}
            setPastedTextBlock={setPastedTextBlock}
            personaListError={personaListError}
            personaPickerLocked={personaPickerLocked}
            personaSelectRows={personaSelectRows}
            quoteFreshness={quoteFreshness}
            reasoningMode={reasoningMode}
            selectedPersonaId={selectedPersonaId}
            setInput={setInput}
            setPasteImageError={setPasteImageError}
            setPendingPasteImages={setPendingPasteImages}
            setReasoningMode={applyReasoningModeChange}
            setSelectedPersonaId={setSelectedPersonaId}
            setVisionUseWorkspace={setVisionUseWorkspace}
            sourcesRailHref={sourcesRailHref}
            tenantFileUploadEnabled={tenantFileUploadEnabled}
            userPickedPersonaRef={userPickedPersonaRef}
            visionUseWorkspace={visionUseWorkspace}
            voiceSessionPersonaLabel={activePersonaName}
            workspacePortfolioId={workspacePortfolioId?.trim() ? workspacePortfolioId.trim() : null}
            hnwiV21SlugForNextAskRef={hnwiV21SlugForNextAskRef}
          />
        </Suspense>
        {mainFooter}
      </div>
    </div>
  );
}
