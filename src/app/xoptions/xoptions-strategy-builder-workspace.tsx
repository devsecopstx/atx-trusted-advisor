"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { XCHAT_PENDING_PROMPT_STORAGE_KEY } from "@/lib/xchat/xchat-pending-prompt";

import { outlookIconClassForSlug, OutlookIconFor } from "@/app/ui/outlook-icons";
import { useWorkspaceAccountSelection } from "@/app/ui/use-workspace-account-selection";
import {
    XoptionsChooseContract,
    type XoptionsSelectedOptionMeta
} from "@/app/xoptions/xoptions-choose-contract";
import { XoptionsDisclaimerModal } from "@/app/xoptions/xoptions-disclaimer-modal";
import { XoptionsErrorBoundary } from "@/app/xoptions/xoptions-error-boundary";
import {
    parseStrategyStartBasis,
    StrategyChoicePanels,
    strategyShortLabel,
    type StrategyCapitalMode,
    type StrategyChoiceId
} from "@/app/xoptions/xoptions-strategy-choice-panels";
import { XoptionsStrategyJobsSection } from "@/app/xoptions/xoptions-strategy-jobs-section";
import {
    isXoptionsStrategyBuilderVisible,
    subscribeXoptionsStrategyBuilderVisibility
} from "@/lib/xoptions-strategy-builder-visibility";
import { trackXoptionsEvent } from "@/lib/xoptions/xoptions-analytics";
import {
    DESK_OUTLOOK_LABELS,
    DESK_RISK_DISPLAY_LABELS
} from "@/modules/core-admin/desk-fields";
import {
    DEFAULT_PORTFOLIO_SCORING_FACTORS,
    SCORING_FACTOR_CATALOG
} from "@/modules/core-admin/scoring-factors";
import type { AccountOutlook } from "@/modules/core-admin/types";

function buildDefaultFactorWeights(): { id: string; weight: number; label: string }[] {
  return DEFAULT_PORTFOLIO_SCORING_FACTORS.map((f) => ({
    id: f.id,
    weight: f.weight,
    label: SCORING_FACTOR_CATALOG[f.id].label
  }));
}

type ScoringFactorRow = {
  id: string;
  weight: number;
  label: string;
  description: string;
  normalization: string;
};

type ContextPayload = {
  portfolio: { id: string; name: string } | null;
  accounts: Array<{
    id: string;
    name: string;
    extAccountId: string;
    isDefault: boolean;
    optionsApproved: boolean;
    riskProfile: "conservative" | "balanced" | "growth" | null;
    outlook: AccountOutlook | null;
  }>;
  account: {
    id: string | null;
    name: string;
    riskProfile: "conservative" | "balanced" | "growth" | null;
    outlook: AccountOutlook | null;
    optionsApproved: boolean;
    cashBalance: number | null;
  };
  bookOutlook: AccountOutlook | null;
  bookRiskProfile: "conservative" | "balanced" | "growth" | null;
  scoringFactors: ScoringFactorRow[];
};

type HoldingRow = {
  symbol: string;
  marketValue: number;
  shares: number;
  lastPrice: number | null;
};

type AtGlanceHoldingRow = HoldingRow & { isCash?: boolean };

type HotRow = {
  symbol: string;
  impliedVolatilityPercent: number;
  openInterest: number;
  strike: number;
  contractType: "call" | "put";
};

type SnapshotPayload = {
  symbol: string;
  lastPrice: number | null;
  rsi14: number | null;
  currency: string | null;
};

type DeskAccountSlice = {
  id: string | null;
  name: string;
  riskProfile: "conservative" | "balanced" | "growth" | null;
  outlook: AccountOutlook | null;
  optionsApproved: boolean;
};

const STEPS = [
  { n: 1 as const, title: "Input symbol", question: "Which company are you looking for?" },
  { n: 2 as const, title: "Choose outlook" },
  { n: 3 as const, title: "Choose strategy" },
  { n: 4 as const, title: "Choose contract" }
];

/** Written when the user enters a symbol; read on `/portfolios` for "Resume". */
const PORTFOLIOS_LAST_XOPTIONS_SYMBOL_KEY = "xf_portfolios_last_xoptions_symbol_v1";

function priceAtPctMove(last: number, pct: number): number {
  return last * (1 + pct / 100);
}

function riskLabel(r: DeskAccountSlice["riskProfile"] | null | undefined): string {
  if (r === "conservative" || r === "balanced" || r === "growth") {
    return DESK_RISK_DISPLAY_LABELS[r];
  }
  return "—";
}

function outlookLabel(o: AccountOutlook | null | undefined): string {
  if (o === "bullish" || o === "neutral" || o === "bearish") {
    return DESK_OUTLOOK_LABELS[o];
  }
  return "—";
}

function mergedOutlookLabels(
  accountOutlook: AccountOutlook | null | undefined,
  bookOutlook: AccountOutlook | null | undefined
): string {
  const la = outlookLabel(accountOutlook);
  const lb = outlookLabel(bookOutlook);
  if (la !== "—" && lb !== "—" && la !== lb) {
    return `${la} · ${lb}`;
  }
  if (la !== "—") {
    return la;
  }
  if (lb !== "—") {
    return lb;
  }
  return "";
}

function slugifyScenarioFilenamePart(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s.length > 0 ? s : "scenario";
}

function buildXoptionsScenarioFileBody(input: {
  displayName: string;
  symbol: string;
  reviewText: string;
  watchlistNotes: string;
}): string {
  const iso = new Date().toISOString();
  const lines = [
    `# xOptions scenario — ${input.displayName}`,
    `Symbol: ${input.symbol}`,
    `Saved (UTC): ${iso}`
  ];
  if (input.watchlistNotes.trim()) {
    lines.push(`Watchlist notes: ${input.watchlistNotes.trim()}`);
  }
  lines.push("", "## Review / order summary", input.reviewText.trim(), "");
  return lines.join("\n");
}

function xoptionsScenarioUploadFilename(displayName: string, symbol: string): string {
  const sym = symbol.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") || "SYM";
  const slug = slugifyScenarioFilenamePart(displayName);
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `xoptions-${sym}-${slug}-${ts}.txt`;
}

export function XoptionsStrategyBuilderWorkspace() {
  const [ctx, setCtx] = useState<ContextPayload | null>(null);
  const [ctxErr, setCtxErr] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [hot, setHot] = useState<HotRow[]>([]);
  const [hotMeta, setHotMeta] = useState<{ scanned: number } | null>(null);
  const [symbol, setSymbol] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [weeks, setWeeks] = useState<number | null>(null);
  const [strategyCapitalMode, setStrategyCapitalMode] = useState<StrategyCapitalMode>("cash");
  const [strategyCapitalInput, setStrategyCapitalInput] = useState("");
  const [activeStep, setActiveStep] = useState<(typeof STEPS)[number]["n"]>(1);
  /** Highest step the user may open (1–4); advances on Next, never ahead of symbol readiness. */
  const [unlockedStep, setUnlockedStep] = useState(1);
  const [strategyChoiceId, setStrategyChoiceId] = useState<StrategyChoiceId | null>(null);
  const [reviewOrderPlainText, setReviewOrderPlainText] = useState<string | null>(null);
  const [yahooOptionSymbol, setYahooOptionSymbol] = useState<string | null>(null);
  const [selectedOptionMeta, setSelectedOptionMeta] = useState<XoptionsSelectedOptionMeta | null>(null);
  const [watchlistAddBusy, setWatchlistAddBusy] = useState(false);
  const [watchlistAddStatus, setWatchlistAddStatus] = useState<string | null>(null);
  const [saveScenarioBusy, setSaveScenarioBusy] = useState(false);
  const [saveScenarioStatus, setSaveScenarioStatus] = useState<string | null>(null);
  const [watchlistNotes, setWatchlistNotes] = useState("");
  const [glanceWide, setGlanceWide] = useState(false);

  const [outlookOverride, setOutlookOverride] = useState<"" | AccountOutlook>("");
  const [riskOverride, setRiskOverride] = useState<"" | "conservative" | "balanced" | "growth">("");
  const [factorWeights, setFactorWeights] = useState(buildDefaultFactorWeights);

  const router = useRouter();
  const showStrategyBuilderJobs = useSyncExternalStore(
    subscribeXoptionsStrategyBuilderVisibility,
    isXoptionsStrategyBuilderVisible,
    () => false
  );

  const onReviewOrderPlainTextChange = useCallback((t: string | null) => {
    setReviewOrderPlainText(t);
  }, []);
  const onYahooOptionSymbolChange = useCallback((s: string | null) => {
    setYahooOptionSymbol(s);
  }, []);
  const onSelectedOptionMetaChange = useCallback((meta: XoptionsSelectedOptionMeta | null) => {
    setSelectedOptionMeta(meta);
  }, []);
  const accountIds = useMemo(() => ctx?.accounts.map((row) => row.id) ?? [], [ctx?.accounts]);
  const strategyStartBasis = useMemo(
    () => parseStrategyStartBasis(strategyCapitalMode, strategyCapitalInput),
    [strategyCapitalMode, strategyCapitalInput]
  );
  const strategyStepSummarySizing = useMemo(() => {
    if (!strategyStartBasis) return null;
    if (strategyStartBasis.mode === "cash") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(strategyStartBasis.usd);
    }
    return `${strategyStartBasis.shares.toLocaleString()} sh`;
  }, [strategyStartBasis]);
  const selectedWorkspaceAccountId = useWorkspaceAccountSelection(
    ctx?.portfolio?.id,
    accountIds,
    ctx?.account?.id ?? null
  );

  const handleAskXchat = useCallback(() => {
    const t = reviewOrderPlainText?.trim();
    if (!t) return;
    const followUp =
      "\n\nGenerate three alternative scenarios for my risk tolerance and income goals using this structure. Label them conservative, base, and aggressive.";
    const full = `${t}${followUp}`;
    try {
      sessionStorage.setItem(XCHAT_PENDING_PROMPT_STORAGE_KEY, full);
    } catch {
      // ignore quota / private mode
    }
    void navigator.clipboard.writeText(full).catch(() => {});
    trackXoptionsEvent("xoptions_xchat_open", { symbol: symbol.trim().toUpperCase() || null });
    router.push("/xchat");
  }, [reviewOrderPlainText, router, symbol]);

  const handleAddOptionToWatchlist = useCallback(async () => {
    const portfolioId = ctx?.portfolio?.id;
    const optionSymbol = yahooOptionSymbol?.trim();
    if (!portfolioId || !optionSymbol) {
      return;
    }
    setWatchlistAddBusy(true);
    setWatchlistAddStatus(null);
    try {
      const strategyLabelPart = strategyChoiceId ? strategyShortLabel(strategyChoiceId) : "Options";
      const lineType = selectedOptionMeta?.side === "put" ? "put_contract" : "call_contract";
      const notes = watchlistNotes.trim();
      const limitEl = document.getElementById("xo-contract-limit") as HTMLInputElement | null;
      const limitNum = parseFloat(limitEl?.value?.trim() ?? "");
      const entryPrice =
        Number.isFinite(limitNum) && limitNum >= 0 ? Number(limitNum.toFixed(4)) : null;
      const strategyMeta = selectedOptionMeta
        ? `${strategyLabelPart} · ${selectedOptionMeta.underlying} ${selectedOptionMeta.expiration} ${selectedOptionMeta.side.toUpperCase()} ${selectedOptionMeta.strike.toFixed(2)} · ${selectedOptionMeta.yahooSymbol}${notes ? ` · Notes: ${notes}` : ""}`
        : `${strategyLabelPart} · ${symbol.trim().toUpperCase()}${notes ? ` · Notes: ${notes}` : ""}`;
      const response = await fetch(`/api/portfolios/${encodeURIComponent(portfolioId)}/watchlist`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addEntries: [
            {
              symbol: optionSymbol,
              lineType,
              strategy: strategyMeta,
              ...(entryPrice != null ? { entryPrice } : {})
            }
          ],
          dedupe: true
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not add to watchlist");
      }
      setWatchlistAddStatus("Added to watchlist");
      trackXoptionsEvent("xoptions_watchlist_add", {
        symbol: optionSymbol,
        hasNotes: notes.length > 0
      });
    } catch (error) {
      setWatchlistAddStatus(error instanceof Error ? error.message : "Could not add to watchlist");
    } finally {
      setWatchlistAddBusy(false);
    }
  }, [ctx?.portfolio?.id, yahooOptionSymbol, strategyChoiceId, selectedOptionMeta, symbol, watchlistNotes]);

  const loadWorkspace = useCallback(async (accountId?: string | null) => {
    setCtxErr(null);
    const params = new URLSearchParams({
      holdingsLimit: "12",
      hotLimit: "3"
    });
    const normalizedAccountId = accountId?.trim();
    if (normalizedAccountId) {
      params.set("accountId", normalizedAccountId);
    }
    const res = await fetch(`/api/app-user/find-options/bootstrap?${params.toString()}`, {
      credentials: "include"
    });
    if (!res.ok) {
      setCtxErr("Could not load portfolio context.");
      return;
    }
    const json = (await res.json()) as {
      data?: {
        context?: Partial<ContextPayload>;
        holdings?: HoldingRow[];
        hot?: { rows: HotRow[]; scanned: number };
      };
    };
    const pack = json.data;
    const d = pack?.context;
    if (!d || typeof d !== "object") {
      setCtxErr("Could not load portfolio context.");
      return;
    }
    setCtx({
      portfolio: d.portfolio ?? null,
      accounts: Array.isArray(d.accounts) ? d.accounts : [],
      account: {
        id: d.account?.id ?? null,
        name: d.account?.name ?? "Account",
        riskProfile: d.account?.riskProfile ?? null,
        outlook: d.account?.outlook ?? null,
        optionsApproved: Boolean(d.account?.optionsApproved),
        cashBalance:
          typeof d.account?.cashBalance === "number" && Number.isFinite(d.account.cashBalance)
            ? d.account.cashBalance
            : null
      },
      bookOutlook: d.bookOutlook ?? null,
      bookRiskProfile: d.bookRiskProfile ?? null,
      scoringFactors: Array.isArray(d.scoringFactors) ? d.scoringFactors : []
    });
    setHoldings(Array.isArray(pack?.holdings) ? pack.holdings : []);
    const hotPack = pack?.hot;
    if (hotPack) {
      setHot(Array.isArray(hotPack.rows) ? hotPack.rows : []);
      setHotMeta({ scanned: typeof hotPack.scanned === "number" ? hotPack.scanned : 0 });
    } else {
      setHot([]);
      setHotMeta(null);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const fn = () => setGlanceWide(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (!ctx?.portfolio?.id) {
      return;
    }
    if (!selectedWorkspaceAccountId) {
      return;
    }
    if (ctx.account.id === selectedWorkspaceAccountId) {
      return;
    }
    void loadWorkspace(selectedWorkspaceAccountId);
  }, [ctx?.account.id, ctx?.portfolio?.id, loadWorkspace, selectedWorkspaceAccountId]);

  useEffect(() => {
    if (!ctx?.scoringFactors?.length) {
      return;
    }
    setFactorWeights(
      ctx.scoringFactors.map((f) => ({
        id: f.id,
        weight: f.weight,
        label: f.label
      }))
    );
  }, [ctx]);

  useEffect(() => {
    const s = symbol.trim().toUpperCase();
    if (s.length < 1) {
      setSnapshot(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setSnapLoading(true);
        try {
          const res = await fetch(
            `/api/app-user/find-options/symbol-snapshot?symbol=${encodeURIComponent(s)}`,
            { credentials: "include" }
          );
          if (res.ok) {
            const json = (await res.json()) as { data: SnapshotPayload };
            setSnapshot(json.data);
          } else {
            setSnapshot(null);
          }
        } finally {
          setSnapLoading(false);
        }
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [symbol]);

  useEffect(() => {
    const s = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,10}$/.test(s)) {
      return;
    }
    try {
      localStorage.setItem(PORTFOLIOS_LAST_XOPTIONS_SYMBOL_KEY, s);
    } catch {
      /* ignore */
    }
  }, [symbol]);

  /** Workspace rail default account — same source as find-options APIs (holdings / hot list). */
  const workspaceDeskAccount = useMemo((): DeskAccountSlice | null => {
    if (!ctx) return null;
    const id = ctx.account.id;
    const row = id ? ctx.accounts.find((a) => a.id === id) : undefined;
    if (row) {
      return {
        id: row.id,
        name: row.name,
        riskProfile: row.riskProfile,
        outlook: row.outlook,
        optionsApproved: row.optionsApproved
      };
    }
    return {
      id: ctx.account.id,
      name: ctx.account.name,
      riskProfile: ctx.account.riskProfile,
      outlook: ctx.account.outlook,
      optionsApproved: ctx.account.optionsApproved
    };
  }, [ctx]);

  const effectiveOutlook = useMemo(() => {
    if (outlookOverride !== "") {
      return outlookLabel(outlookOverride);
    }
    return mergedOutlookLabels(workspaceDeskAccount?.outlook, ctx?.bookOutlook);
  }, [ctx?.bookOutlook, outlookOverride, workspaceDeskAccount?.outlook]);

  const outlookIconSlug = useMemo((): AccountOutlook | null => {
    if (outlookOverride !== "") {
      return outlookOverride;
    }
    if (!ctx) {
      return null;
    }
    return workspaceDeskAccount?.outlook ?? ctx.bookOutlook ?? null;
  }, [ctx, outlookOverride, workspaceDeskAccount?.outlook]);

  const effectiveRisk = useMemo(() => {
    const r = riskOverride || workspaceDeskAccount?.riskProfile || ctx?.bookRiskProfile || null;
    return riskLabel(r);
  }, [ctx?.bookRiskProfile, riskOverride, workspaceDeskAccount?.riskProfile]);

  const effectiveFactors = useMemo(() => factorWeights, [factorWeights]);
  const atGlanceHoldings = useMemo<AtGlanceHoldingRow[]>(() => {
    const rows: AtGlanceHoldingRow[] = [...holdings];
    const cash = ctx?.account?.cashBalance;
    if (typeof cash === "number" && Number.isFinite(cash) && cash >= 0) {
      rows.unshift({
        symbol: "CASH",
        marketValue: cash,
        shares: 0,
        lastPrice: 1,
        isCash: true
      });
    }
    return rows;
  }, [ctx?.account?.cashBalance, holdings]);

  const weightSum = useMemo(
    () => effectiveFactors.reduce((s, f) => s + f.weight, 0),
    [effectiveFactors]
  );
  const weightOk = Math.abs(weightSum - 1) < 0.02;

  const symbolUpper = symbol.trim().toUpperCase();

  const portfolioApproxValue = useMemo(
    () => atGlanceHoldings.reduce((s, h) => s + (Number.isFinite(h.marketValue) ? h.marketValue : 0), 0),
    [atGlanceHoldings]
  );

  const holdingSharesForSymbol = useMemo(() => {
    const row = holdings.find((h) => h.symbol === symbolUpper);
    return row != null && Number.isFinite(row.shares) ? row.shares : null;
  }, [holdings, symbolUpper]);

  const handleSaveScenario = useCallback(async () => {
    const t = reviewOrderPlainText?.trim();
    if (!t) {
      return;
    }
    const name = window.prompt("Scenario name");
    if (!name?.trim()) {
      return;
    }
    setSaveScenarioStatus(null);

    try {
      const key = "xf_xoptions_scenarios_v1";
      const raw = localStorage.getItem(key);
      const prev = raw ? (JSON.parse(raw) as unknown) : [];
      const arr = Array.isArray(prev) ? prev : [];
      arr.push({
        name: name.trim(),
        text: t,
        savedAt: new Date().toISOString(),
        symbol: symbolUpper
      });
      localStorage.setItem(key, JSON.stringify(arr.slice(-20)));
    } catch {
      /* ignore */
    }

    const body = buildXoptionsScenarioFileBody({
      displayName: name.trim(),
      symbol: symbolUpper,
      reviewText: t,
      watchlistNotes
    });
    const filename = xoptionsScenarioUploadFilename(name.trim(), symbolUpper);
    const file = new File([body], filename, { type: "text/plain;charset=utf-8" });
    const fd = new FormData();
    fd.set("file", file);

    setSaveScenarioBusy(true);
    let workspaceSynced = false;
    try {
      const res = await fetch("/api/app-user/xchat/attachments", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { linkedToCollection?: boolean; linkError?: string };
      };

      if (res.status === 401) {
        setSaveScenarioStatus(
          "Saved on this device — sign in with Premium+ to sync to xChat workspace files."
        );
        trackXoptionsEvent("xoptions_scenario_save", { symbol: symbolUpper, workspaceSynced });
        return;
      }
      if (res.status === 403) {
        setSaveScenarioStatus(
          "Saved on this device — Premium+ required to upload to the tenant workspace (xChat → files)."
        );
        trackXoptionsEvent("xoptions_scenario_save", { symbol: symbolUpper, workspaceSynced });
        return;
      }
      if (!res.ok) {
        const err = json.error?.trim();
        setSaveScenarioStatus(err ? `Not synced: ${err}` : `Not synced (${res.status}).`);
        trackXoptionsEvent("xoptions_scenario_save", { symbol: symbolUpper, workspaceSynced });
        return;
      }

      const linked = json.data?.linkedToCollection === true;
      workspaceSynced = linked;
      const linkErr = json.data?.linkError?.trim();
      if (linked) {
        setSaveScenarioStatus("Synced to workspace — appears under xChat → files for your tenant.");
      } else if (linkErr) {
        setSaveScenarioStatus(`Uploaded; link pending: ${linkErr}`);
      } else {
        setSaveScenarioStatus("Uploaded — collection link may still be configuring.");
      }
      trackXoptionsEvent("xoptions_scenario_save", { symbol: symbolUpper, workspaceSynced });
    } catch {
      setSaveScenarioStatus("Saved on this device — network error; could not sync to workspace.");
      trackXoptionsEvent("xoptions_scenario_save", { symbol: symbolUpper, workspaceSynced });
    } finally {
      setSaveScenarioBusy(false);
    }
  }, [reviewOrderPlainText, symbolUpper, watchlistNotes]);

  const handlePrintSummary = useCallback(() => {
    trackXoptionsEvent("xoptions_export_print", { symbol: symbolUpper });
    window.print();
  }, [symbolUpper]);

  const quoteLastPrice = useMemo((): number | null => {
    if (snapshot?.symbol !== symbolUpper || snapshot.lastPrice == null) {
      return null;
    }
    const p = snapshot.lastPrice;
    return Number.isFinite(p) ? p : null;
  }, [snapshot, symbolUpper]);
  const step1Complete = symbolUpper.length >= 1 && !snapLoading;
  const canGoStep2 = step1Complete;

  useEffect(() => {
    if (!canGoStep2) {
      setUnlockedStep(1);
      setActiveStep((s) => (s > 1 ? 1 : s));
      setStrategyChoiceId(null);
    }
  }, [canGoStep2]);

  function resetDeskToPortfolio() {
    setOutlookOverride("");
    setRiskOverride("");
    if (ctx) {
      setFactorWeights(
        ctx.scoringFactors.map((f) => ({
          id: f.id,
          weight: f.weight,
          label: f.label
        }))
      );
    }
  }

  function resetWeightsToPortfolio() {
    if (!ctx) return;
    setFactorWeights(
      ctx.scoringFactors.map((f) => ({
        id: f.id,
        weight: f.weight,
        label: f.label
      }))
    );
  }

  function updateFactorWeight(id: string, pct: number) {
    setFactorWeights((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, weight: Math.min(1, Math.max(0, pct / 100)) } : row
      )
    );
  }

  function goStep(n: (typeof STEPS)[number]["n"]) {
    if (n < 1 || n > 4 || n > unlockedStep) return;
    setActiveStep(n);
  }

  function advanceFrom(step: (typeof STEPS)[number]["n"]) {
    if (step < 1 || step > 3) return;
    if (step === 1 && !canGoStep2) return;
    const next = (step + 1) as (typeof STEPS)[number]["n"];
    setUnlockedStep((u) => Math.max(u, next));
    setActiveStep(next);
  }

  function stepHeaderClass(n: (typeof STEPS)[number]["n"]): string {
    if (n === activeStep) return "xoptions-step__head xoptions-step__head--active";
    if (n < activeStep) return "xoptions-step__head xoptions-step__head--done";
    return "xoptions-step__head xoptions-step__head--pending";
  }

  return (
    <>
      <XoptionsDisclaimerModal />
      <div className="xoptions-workspace xoptions-print-root space-y-4 max-w-[min(100%,88rem)] px-0" id="xoptions-print-root">
      <div>
        <p className="xoptions-page-kicker">Options analysis &amp; research</p>
        <h1 className="xoptions-workspace__h1 mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Find options
        </h1>
      </div>

      <section className="xoptions-workspace-topbar" aria-label="Selected workspace">
        <p className="xoptions-workspace-topbar__line text-sm">
          <span className="text-[var(--xf-text-400)]">Portfolio</span>{" "}
          <span className="font-semibold text-[var(--xf-text-200)]">{ctx?.portfolio?.name ?? "—"}</span>
          <span className="mx-2 text-[var(--xf-text-500)]" aria-hidden>
            ·
          </span>
          <span className="text-[var(--xf-text-400)]">Account</span>{" "}
          <span className="font-semibold text-[var(--xf-text-200)]">
            {workspaceDeskAccount?.name ?? ctx?.account?.name ?? "—"}
          </span>
        </p>
        <p className="xoptions-workspace-topbar__glance text-xs text-[var(--xf-text-400)]">
          At a glance: {holdings.length} holdings
          {typeof ctx?.account?.cashBalance === "number" && Number.isFinite(ctx.account.cashBalance) ? (
            <>
              {" "}
              · Cash $
              {ctx.account.cashBalance.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </>
          ) : null}
          {" "}
          · {hot.length} hot symbols
        </p>
      </section>

      {showStrategyBuilderJobs ? (
        <Suspense fallback={null}>
          <XoptionsStrategyJobsSection />
        </Suspense>
      ) : null}

      <nav className="xoptions-stepper" aria-label="Strategy builder progress">
        {STEPS.map((s, i) => (
          <div key={s.n} className="xoptions-stepper__segment">
            <button
              type="button"
              className={`xoptions-stepper__node ${s.n === activeStep ? "xoptions-stepper__node--current" : ""} ${s.n < activeStep ? "xoptions-stepper__node--complete" : ""} ${s.n > activeStep ? "xoptions-stepper__node--future" : ""}`}
              aria-current={s.n === activeStep ? "step" : undefined}
              disabled={s.n > unlockedStep}
              onClick={() => goStep(s.n)}
            >
              <span className="xoptions-stepper__node-num">{s.n}</span>
              <span className="xoptions-stepper__node-label">{s.title}</span>
            </button>
            {i < STEPS.length - 1 ? <span className="xoptions-stepper__rail" aria-hidden /> : null}
          </div>
        ))}
      </nav>

      <section className="xoptions-symbol-glance-row" aria-label="Enter symbol and portfolio snapshot">
        <div className="xoptions-symbol-hero xoptions-symbol-hero--in-row" aria-label="Enter symbol">
          <p className="xoptions-step__question m-0">{STEPS[0]?.question}</p>
          <div className="mt-3 max-w-md">
            <label
              className="mb-1 block text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--xf-text-400)]"
              htmlFor="xo-symbol"
            >
              Symbol
            </label>
            <div className="relative">
              <input
                id="xo-symbol"
                className="crud-input w-full pr-10 font-mono text-base uppercase md:text-lg"
                placeholder="e.g. AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
                aria-label="Underlying symbol"
              />
              <span
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--xf-text-400)]"
                aria-hidden
              >
                🔍
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              className="xoptions-next-btn"
              disabled={!canGoStep2}
              onClick={() => advanceFrom(1)}
            >
              Next
            </button>
            {symbolUpper.length > 0 ? (
              snapLoading ? (
                <div className="text-xs text-[var(--xf-text-400)]" role="status">
                  Loading quote…
                </div>
              ) : snapshot?.symbol !== symbolUpper ? (
                <div className="text-xs text-[var(--xf-text-400)]" role="status">
                  Enter a valid symbol
                </div>
              ) : quoteLastPrice == null ? (
                <div className="text-xs text-[var(--xf-text-400)]" role="status">
                  No last price
                </div>
              ) : (
                <div
                  className="xoptions-price-ladder min-w-0 flex-1"
                  role="status"
                  aria-label={`Price levels vs last ${quoteLastPrice.toFixed(2)}`}
                >
                  {([-15, -10, -5] as const).map((pct) => (
                    <span key={pct} className="xoptions-price-ladder__cell">
                      <span className="xoptions-price-ladder__label">{pct}%</span>
                      <span className="xoptions-price-ladder__value">
                        ${priceAtPctMove(quoteLastPrice, pct).toFixed(2)}
                      </span>
                    </span>
                  ))}
                  <span className="xoptions-price-ladder__cell xoptions-price-ladder__cell--spot">
                    <span className="xoptions-price-ladder__label">Last</span>
                    <span className="xoptions-price-ladder__value">${quoteLastPrice.toFixed(2)}</span>
                  </span>
                  {([5, 10, 15] as const).map((pct) => (
                    <span key={pct} className="xoptions-price-ladder__cell">
                      <span className="xoptions-price-ladder__label">+{pct}%</span>
                      <span className="xoptions-price-ladder__value">
                        ${priceAtPctMove(quoteLastPrice, pct).toFixed(2)}
                      </span>
                    </span>
                  ))}
                </div>
              )
            ) : null}
          </div>
        </div>

        <aside className="xoptions-symbol-glance-row__glance min-w-0" aria-label="At a glance">
          <details className="xoptions-glance-disclosure" open={glanceWide}>
            <summary className="lg:hidden">At a glance · holdings &amp; hot list</summary>
            <div className="xoptions-at-a-glance xoptions-at-a-glance--symbol-column pt-2 lg:pt-0">
            <p className="xoptions-at-a-glance__head hidden lg:block">At a glance</p>
            <div className="xoptions-at-a-glance__grid">
              <div className="min-w-0">
                <p className="xoptions-at-a-glance__title">Holdings</p>
                <p className="xoptions-at-a-glance__sub">By value</p>
                <ul className="xoptions-at-a-glance__list">
                  {atGlanceHoldings.length === 0 ? (
                    <li className="xoptions-at-a-glance__sub">None.</li>
                  ) : (
                    atGlanceHoldings.map((row) => (
                      <li key={row.symbol}>
                        {row.isCash ? (
                          <span className="xoptions-symbol-row xoptions-symbol-row--compact">
                            <span className="xoptions-symbol-row__sym">{row.symbol}</span>
                            <span className="xoptions-symbol-row__meta">
                              ${row.marketValue.toLocaleString("en-US", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="xoptions-symbol-row xoptions-symbol-row--compact"
                            onClick={() => {
                              setSymbol(row.symbol);
                              setActiveStep(1);
                            }}
                          >
                            <span className="xoptions-symbol-row__sym">{row.symbol}</span>
                            <span className="xoptions-symbol-row__meta">
                              {row.shares.toLocaleString()} sh · ${row.marketValue.toLocaleString("en-US", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </span>
                          </button>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="min-w-0">
                <p className="xoptions-at-a-glance__title">Hot list</p>
                <p className="xoptions-at-a-glance__sub">IV/OI</p>
                <ul className="xoptions-at-a-glance__list">
                  {hot.length === 0 ? (
                    <li className="xoptions-at-a-glance__sub">
                      —{hotMeta ? ` (${hotMeta.scanned})` : ""}
                    </li>
                  ) : (
                    hot.map((row) => (
                      <li key={row.symbol}>
                        <button
                          type="button"
                          className="xoptions-symbol-row xoptions-symbol-row--compact"
                          onClick={() => {
                            setSymbol(row.symbol);
                            setActiveStep(1);
                          }}
                        >
                          <span className="xoptions-symbol-row__sym">{row.symbol}</span>
                          <span className="xoptions-symbol-row__meta">
                            {row.impliedVolatilityPercent.toFixed(0)}% · {row.openInterest.toLocaleString()}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
          </details>
        </aside>
      </section>

      {ctxErr ? <p className="xoptions-alert">{ctxErr}</p> : null}

      <div className="xoptions-steps space-y-0" aria-label="Builder steps">
        {/* Step 1 */}
        <section className="xoptions-step" aria-labelledby="xo-step-1-title">
          <button
            type="button"
            className={stepHeaderClass(1)}
            id="xo-step-1-title"
            onClick={() => goStep(1)}
          >
            <span className="xoptions-step__num">1</span>
            <span className="xoptions-step__title">{STEPS[0]?.title}</span>
            {activeStep !== 1 && symbolUpper ? (
              <span className="xoptions-step__summary font-mono">{symbolUpper}</span>
            ) : null}
          </button>
          {activeStep === 1 ? (
            <div className="xoptions-step__body">
              <p className="xoptions-hint text-sm text-[var(--xf-text-400)]">
                Enter a ticker in the field above. Holdings and hot list use your workspace account from the left rail.
              </p>
            </div>
          ) : null}
        </section>

        {/* Step 2 */}
        <section className="xoptions-step" aria-labelledby="xo-step-2-title">
          <button
            type="button"
            className={stepHeaderClass(2)}
            id="xo-step-2-title"
            disabled={unlockedStep < 2}
            onClick={() => goStep(2)}
          >
            <span className="xoptions-step__num">2</span>
            <span className="xoptions-step__title">{STEPS[1]?.title}</span>
            {activeStep !== 2 && unlockedStep >= 2 ? (
              <span className="xoptions-step__summary">
                {effectiveOutlook || "—"} · {effectiveRisk}
              </span>
            ) : null}
          </button>
          {activeStep === 2 && canGoStep2 ? (
            <div className="xoptions-step__body space-y-4">
              <div className="xoptions-step-context-card">
                <p className="xoptions-step-context-card__line text-xs">
                  <span className="text-[var(--xf-text-400)]">Portfolio</span>{" "}
                  <span className="font-semibold text-[var(--xf-text-200)]">{ctx?.portfolio?.name ?? "—"}</span>
                  <span className="mx-2 text-[var(--xf-text-500)]" aria-hidden>
                    ·
                  </span>
                  <span className="text-[var(--xf-text-400)]">Account</span>{" "}
                  <span className="font-semibold text-[var(--xf-text-200)]">
                    {workspaceDeskAccount?.name ?? ctx?.account?.name ?? "—"}
                  </span>
                </p>
                <p className="xoptions-step-context-card__line mt-2 text-xs">
                  <span className="text-[var(--xf-text-400)]">Desk</span>{" "}
                  <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold text-[var(--xf-text-200)]">
                    {outlookIconSlug ? (
                      <span
                        className={`inline-flex shrink-0 items-center ${outlookIconClassForSlug(outlookIconSlug)}`}
                        aria-hidden
                      >
                        <OutlookIconFor className="h-4 w-4" outlook={outlookIconSlug} />
                      </span>
                    ) : null}
                    <span>{effectiveOutlook || "—"}</span>
                    <span className="text-[var(--xf-text-500)]" aria-hidden>
                      ·
                    </span>
                    <span>{ctx ? effectiveRisk : "—"}</span>
                  </span>
                </p>
                <p className="xoptions-hint mt-2 text-xs text-[var(--xf-text-400)]">
                  Expand below to adjust scoring weights, outlook override, and risk. You can continue with the
                  defaults shown here.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="xoptions-next-btn" onClick={() => advanceFrom(2)}>
                  Next
                </button>
              </div>

              <details className="xoptions-scoring-drop" aria-label="Scoring factors and desk overrides">
                <summary className="xoptions-scoring-drop__summary">
                  <span className="xoptions-scoring-drop__summary-text">
                    <span className="xoptions-workspace-preferences__title">
                      Scoring factors &amp; outlook / risk
                    </span>
                    <span className="xoptions-workspace-preferences__sub">
                      Optional — weights, outlook override, and risk profile
                    </span>
                  </span>
                  <span className="xoptions-scoring-drop__chev" aria-hidden>
                    ▾
                  </span>
                </summary>
                <div className="xoptions-scoring-drop__body space-y-4">
                  <div>
                    <p className="xoptions-workspace__label mb-2">Scoring factors</p>
                    <ul className="xoptions-scoring-drop__factors">
                      {effectiveFactors.length === 0 ? (
                        <li className="xoptions-hint list-none text-xs">No factors — portfolio defaults apply.</li>
                      ) : (
                        effectiveFactors.map((f) => (
                          <li key={f.id} className="xoptions-scoring-drop__factor-row">
                            <span className="xoptions-scoring-drop__factor-label">{f.label}</span>
                            <input
                              type="number"
                              className="crud-input xoptions-scoring-drop__factor-input font-mono"
                              min={0}
                              max={100}
                              step={1}
                              value={Math.round(f.weight * 1000) / 10}
                              onChange={(e) => updateFactorWeight(f.id, Number(e.target.value))}
                              aria-label={`Weight percent for ${f.label}`}
                            />
                            <span className="xoptions-inline-muted">%</span>
                          </li>
                        ))
                      )}
                    </ul>
                    <p className={`text-xs ${weightOk ? "xoptions-hint" : "xoptions-warning"}`}>
                      Sum {(weightSum * 100).toFixed(1)}% (target 100%)
                    </p>
                    <button type="button" className="xoptions-text-link text-xs" onClick={resetWeightsToPortfolio}>
                      Reset weights to portfolio
                    </button>
                  </div>

                  <div className="xoptions-top-option-header__desk xoptions-step__desk-card p-2">
                    <p className="xoptions-top-option-header__desk-line line-clamp-2 inline-flex flex-wrap items-center gap-1.5">
                      <span className="xoptions-inline-muted shrink-0">Outlook </span>
                      {outlookIconSlug ? (
                        <span
                          className={`inline-flex shrink-0 items-center ${outlookIconClassForSlug(outlookIconSlug)}`}
                          aria-hidden
                        >
                          <OutlookIconFor className="h-4 w-4" outlook={outlookIconSlug} />
                        </span>
                      ) : null}
                      <span>{effectiveOutlook || "—"}</span>
                    </p>
                    <p className="xoptions-top-option-header__desk-line">
                      <span className="xoptions-inline-muted">Risk </span>
                      {ctx ? effectiveRisk : "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <div className="min-w-0">
                      <label className="xoptions-workspace__label block" htmlFor="xo-outlook">
                        Outlook override
                      </label>
                      <div className="mt-1 flex max-w-full items-center gap-2">
                        {outlookIconSlug ? (
                          <span
                            className={`inline-flex shrink-0 ${outlookIconClassForSlug(outlookIconSlug)}`}
                            aria-hidden
                          >
                            <OutlookIconFor className="h-5 w-5" outlook={outlookIconSlug} />
                          </span>
                        ) : (
                          <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />
                        )}
                        <select
                          id="xo-outlook"
                          className="crud-input min-w-0 flex-1"
                          value={outlookOverride}
                          onChange={(e) =>
                            setOutlookOverride(
                              e.target.value === "" ? "" : (e.target.value as AccountOutlook)
                            )
                          }
                        >
                          <option value="">
                            Use account / book (
                            {mergedOutlookLabels(workspaceDeskAccount?.outlook, ctx?.bookOutlook) || "—"})
                          </option>
                          <option value="bullish">{DESK_OUTLOOK_LABELS.bullish}</option>
                          <option value="neutral">{DESK_OUTLOOK_LABELS.neutral}</option>
                          <option value="bearish">{DESK_OUTLOOK_LABELS.bearish}</option>
                        </select>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label className="xoptions-workspace__label block" htmlFor="xo-risk">
                        Risk
                      </label>
                      <select
                        id="xo-risk"
                        className="crud-input mt-1 w-full min-w-0"
                        value={riskOverride}
                        onChange={(e) =>
                          setRiskOverride(
                            e.target.value === ""
                              ? ""
                              : (e.target.value as "conservative" | "balanced" | "growth")
                          )
                        }
                      >
                        <option value="">
                          Use portfolio / account (
                          {riskLabel(workspaceDeskAccount?.riskProfile ?? ctx?.bookRiskProfile ?? null)})
                        </option>
                        <option value="conservative">Conservative</option>
                        <option value="balanced">Balanced</option>
                        <option value="growth">{DESK_RISK_DISPLAY_LABELS.growth}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="xoptions-text-link text-sm" onClick={resetDeskToPortfolio}>
                      Reset desk to portfolio
                    </button>
                  </div>
                </div>
              </details>
            </div>
          ) : null}
        </section>

        {/* Step 3 */}
        <section className="xoptions-step" aria-labelledby="xo-step-3-title">
          <button
            type="button"
            className={stepHeaderClass(3)}
            id="xo-step-3-title"
            disabled={unlockedStep < 3}
            onClick={() => goStep(3)}
          >
            <span className="xoptions-step__num">3</span>
            <span className="xoptions-step__title">{STEPS[2]?.title}</span>
            {activeStep !== 3 && unlockedStep >= 3 ? (
              <span className="xoptions-step__summary">
                {[
                  weeks != null ? `~${weeks}d` : null,
                  strategyStepSummarySizing,
                  strategyShortLabel(strategyChoiceId)
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            ) : null}
          </button>
          {activeStep === 3 && canGoStep2 ? (
            <div className="xoptions-step__body space-y-4">
              <StrategyChoicePanels
                selectedId={strategyChoiceId}
                onSelectStrategy={setStrategyChoiceId}
                capitalMode={strategyCapitalMode}
                capitalInput={strategyCapitalInput}
                onCapitalModeChange={setStrategyCapitalMode}
                onCapitalInputChange={setStrategyCapitalInput}
              />
              <p className="xoptions-hint text-xs text-[var(--xf-text-400)]">
                Set target horizon and contract details in the next step.
              </p>
              <button type="button" className="xoptions-next-btn" onClick={() => advanceFrom(3)}>
                Next
              </button>
            </div>
          ) : null}
        </section>

        {/* Step 4 */}
        <section className="xoptions-step" aria-labelledby="xo-step-4-title">
          <button
            type="button"
            className={stepHeaderClass(4)}
            id="xo-step-4-title"
            disabled={unlockedStep < 4}
            onClick={() => goStep(4)}
          >
            <span className="xoptions-step__num">4</span>
            <span className="xoptions-step__title">{STEPS[3]?.title}</span>
          </button>
          {activeStep === 4 && canGoStep2 ? (
            <div className="xoptions-step__body space-y-4">
              <XoptionsErrorBoundary>
              <XoptionsChooseContract
                symbol={symbol}
                weeks={weeks}
                onWeeksChange={setWeeks}
                lastPrice={snapshot?.lastPrice ?? null}
                onYahooOptionSymbolChange={onYahooOptionSymbolChange}
                onSelectedOptionMetaChange={onSelectedOptionMetaChange}
                strategyChoiceId={strategyChoiceId}
                strategyLabel={strategyChoiceId ? strategyShortLabel(strategyChoiceId) : null}
                onReviewOrderPlainTextChange={onReviewOrderPlainTextChange}
                portfolioApproxValue={portfolioApproxValue}
                holdingSharesForSymbol={holdingSharesForSymbol}
                strategyStartBasis={strategyStartBasis}
              />
              </XoptionsErrorBoundary>
              <div className="max-w-xl">
                <label className="mb-1 block text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--xf-text-400)]" htmlFor="xo-watchlist-notes">
                  Watchlist notes (optional)
                </label>
                <textarea
                  id="xo-watchlist-notes"
                  className="crud-input min-h-[4rem] w-full font-mono text-sm"
                  placeholder="Limit context, catalyst, roll plan"
                  value={watchlistNotes}
                  onChange={(e) => setWatchlistNotes(e.target.value)}
                  aria-label="Notes appended when adding contract to watchlist"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="cta cta-secondary xoptions-chain-cta"
                  disabled={watchlistAddBusy || !ctx?.portfolio?.id || !yahooOptionSymbol?.trim()}
                  onClick={() => void handleAddOptionToWatchlist()}
                >
                  {watchlistAddBusy ? "Adding..." : "Add to watchlist"}
                </button>
                <Link
                  className="cta cta-primary xoptions-chain-cta"
                  href={
                    symbol.trim()
                      ? `/xoptions/full-chain?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}${
                          weeks != null ? `&weeks=${weeks}` : ""
                        }`
                      : "/xoptions/full-chain"
                  }
                >
                  Open full option chain
                </Link>
                <button
                  type="button"
                  className="cta cta-secondary xoptions-chain-cta"
                  disabled={!reviewOrderPlainText?.trim()}
                  onClick={handleAskXchat}
                  aria-label="Copy review order to clipboard and open xChat"
                >
                  Ask xChat
                </button>
                <button
                  type="button"
                  className="cta cta-secondary xoptions-chain-cta"
                  disabled={saveScenarioBusy || !reviewOrderPlainText?.trim()}
                  onClick={() => void handleSaveScenario()}
                >
                  {saveScenarioBusy ? "Saving…" : "Save scenario"}
                </button>
                <button type="button" className="cta cta-secondary xoptions-chain-cta" onClick={handlePrintSummary}>
                  Print / PDF
                </button>
              </div>
              {yahooOptionSymbol ? (
                <p className="xoptions-hint text-xs text-[var(--xf-text-400)]">
                  Yahoo option chain id:{" "}
                  <span className="font-mono text-[var(--xf-text-200)]">{yahooOptionSymbol}</span>
                </p>
              ) : null}
              {watchlistAddStatus ? (
                <p
                  className={`xoptions-hint text-xs ${watchlistAddStatus === "Added to watchlist" ? "text-[var(--xf-gain-green)]" : "text-red-300"}`}
                  role="status"
                >
                  {watchlistAddStatus}
                </p>
              ) : null}
              {saveScenarioStatus ? (
                <p
                  className={`xoptions-hint text-xs ${
                    saveScenarioStatus.startsWith("Synced to workspace")
                      ? "text-[var(--xf-gain-green)]"
                      : saveScenarioStatus.startsWith("Uploaded;") ||
                          saveScenarioStatus.startsWith("Uploaded —")
                        ? "text-amber-300"
                        : saveScenarioStatus.startsWith("Not synced:")
                          ? "text-red-300"
                          : "text-[var(--xf-text-400)]"
                  }`}
                  role="status"
                >
                  {saveScenarioStatus}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      <footer className="xoptions-legal-footer mt-6 border-t border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] pt-4 text-[0.7rem] leading-relaxed text-[var(--xf-text-400)]">
        Not financial, tax, or legal advice. Options involve substantial risk of loss. Past performance is not
        indicative of future results. Consult your advisor. Data may be delayed.
      </footer>
    </div>
    </>
  );
}
