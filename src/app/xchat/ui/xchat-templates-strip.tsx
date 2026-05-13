"use client";

import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
    type KeyboardEvent as ReactKeyboardEvent,
    type RefObject
} from "react";

import { AnimatePresence, motion } from "framer-motion";

import { getXchatComposerTextareaMaxPx } from "@/lib/xchat/xchat-composer-textarea-max";
import {
    isHnwiPromptTemplateV21Slug,
    type HnwiPromptTemplateV21Slug
} from "@/modules/xchat/prompt-templates-v21-defaults";
import {
    filterXchatPromptTemplates,
    resolveWheelCcScanComposerPrompt,
    XCHAT_HNWI_PROMPT_TEMPLATES,
    type XchatPromptTemplate
} from "@/modules/xchat/xchat-hnwi-templates";

type UserTemplateRow = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
};

type StripTemplate = XchatPromptTemplate & { savedDocId?: string };

export type XchatTemplatesStripProps = {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  setInput: (v: string) => void;
  /** Current composer text — for “Save template” prefill. */
  composerDraft: string;
  initiallyExpanded?: boolean;
  /** xChat ask in flight — status line + disabled scan CTA. */
  askInFlight?: boolean;
  /** Scoped workspace portfolio for HNWI v2.1 template resolution. */
  workspacePortfolioId?: string | null;
  hnwiV21SlugForNextAskRef: MutableRefObject<string | null>;
};

export function XchatTemplatesStrip({
  composerRef,
  setInput,
  composerDraft,
  initiallyExpanded = false,
  askInFlight = false,
  workspacePortfolioId = null,
  hnwiV21SlugForNextAskRef
}: XchatTemplatesStripProps) {
  const searchId = useId();
  const saveHeadingId = useId();
  const saveTitleFieldId = useId();
  const savePromptFieldId = useId();
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(initiallyExpanded);
  const [seeAllOpen, setSeeAllOpen] = useState(initiallyExpanded);
  const [libraryExpanded, setLibraryExpanded] = useState(initiallyExpanded);
  const [userRows, setUserRows] = useState<UserTemplateRow[]>([]);
  const [userLoadFailed, setUserLoadFailed] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [savePrompt, setSavePrompt] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [busyHnwiSlug, setBusyHnwiSlug] = useState<HnwiPromptTemplateV21Slug | null>(null);
  const moreWrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const moreMenuId = useId();

  const onScrollerKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const step = Math.min(160, Math.max(80, Math.floor(el.clientWidth * 0.35)));
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      el.scrollBy({ left: step, behavior: "smooth" });
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      el.scrollBy({ left: -step, behavior: "smooth" });
      e.preventDefault();
    } else if (e.key === "Home") {
      el.scrollTo({ left: 0, behavior: "smooth" });
      e.preventDefault();
    } else if (e.key === "End") {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    if (!moreMenuOpen) {
      return;
    }
    function onDocMouseDown(e: MouseEvent) {
      if (!moreWrapRef.current?.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    function onDocKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [moreMenuOpen]);

  const refreshUserTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/app-user/xchat/prompt-templates", {
        credentials: "include"
      });
      if (res.status === 401 || res.status === 403) {
        setUserRows([]);
        setUserLoadFailed(true);
        return;
      }
      if (!res.ok) {
        setUserRows([]);
        setUserLoadFailed(false);
        return;
      }
      const body = (await res.json()) as {
        data?: { templates?: UserTemplateRow[] };
      };
      setUserRows(body.data?.templates ?? []);
      setUserLoadFailed(false);
    } catch {
      setUserRows([]);
      setUserLoadFailed(false);
    }
  }, []);

  useEffect(() => {
    void refreshUserTemplates();
  }, [refreshUserTemplates]);

  const mergedTemplates: StripTemplate[] = useMemo(() => {
    const saved: StripTemplate[] = userRows.map((r) => ({
      id: `saved-${r.id}`,
      title: r.title,
      subtitle: r.subtitle?.trim() ? r.subtitle : "Saved · you",
      prompt: r.prompt,
      savedDocId: r.id
    }));
    return [...saved, ...XCHAT_HNWI_PROMPT_TEMPLATES];
  }, [userRows]);

  const filtered = useMemo(
    () => filterXchatPromptTemplates(mergedTemplates, query),
    [mergedTemplates, query]
  );

  const scrollerTemplates = filtered.slice(0, 8);

  const focusComposerAndResize = useCallback(() => {
    queueMicrotask(() => {
      const el = composerRef.current;
      if (el) {
        el.focus();
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, getXchatComposerTextareaMaxPx())}px`;
      }
    });
  }, [composerRef]);

  const applyTemplate = useCallback(
    async (t: StripTemplate) => {
      const slugRaw = t.hnwiV21Slug;
      if (slugRaw && isHnwiPromptTemplateV21Slug(slugRaw)) {
        if (askInFlight || busyHnwiSlug) {
          return;
        }
        setBusyHnwiSlug(slugRaw);
        try {
          const q = workspacePortfolioId?.trim()
            ? `?portfolioId=${encodeURIComponent(workspacePortfolioId.trim())}`
            : "";
          const res = await fetch(
            `/api/app-user/xchat/prompt-template-v21/${encodeURIComponent(slugRaw)}${q}`,
            { credentials: "include" }
          );
          const body = (await res.json().catch(() => ({}))) as {
            data?: { composerText?: string };
          };
          if (res.ok && body.data?.composerText) {
            hnwiV21SlugForNextAskRef.current = slugRaw;
            setInput(body.data.composerText);
          } else {
            hnwiV21SlugForNextAskRef.current = null;
            setInput(resolveWheelCcScanComposerPrompt(t.prompt));
          }
        } catch {
          hnwiV21SlugForNextAskRef.current = null;
          setInput(resolveWheelCcScanComposerPrompt(t.prompt));
        } finally {
          setBusyHnwiSlug(null);
        }
        focusComposerAndResize();
        return;
      }
      hnwiV21SlugForNextAskRef.current = null;
      setInput(resolveWheelCcScanComposerPrompt(t.prompt));
      focusComposerAndResize();
    },
    [askInFlight, busyHnwiSlug, focusComposerAndResize, hnwiV21SlugForNextAskRef, setInput, workspacePortfolioId]
  );

  async function removeSaved(docId: string) {
    try {
      const res = await fetch(`/api/app-user/xchat/prompt-templates/${encodeURIComponent(docId)}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        void refreshUserTemplates();
      }
    } catch {
      /* ignore */
    }
  }

  function openSaveDialog() {
    const draft = composerDraft.trim();
    setSaveTitle(draft ? draft.slice(0, 60) : "");
    setSavePrompt(draft);
    setSaveError(null);
    setSaveOpen(true);
  }

  async function submitSave() {
    setSaveBusy(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/app-user/xchat/prompt-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: saveTitle.trim() || "My prompt",
          subtitle: "",
          prompt: savePrompt.trim()
        })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSaveError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      setSaveOpen(false);
      void refreshUserTemplates();
      setSeeAllOpen(true);
      setSearchVisible(true);
    } catch {
      setSaveError("Network error while saving.");
    } finally {
      setSaveBusy(false);
    }
  }

  const templatesRowTail = (
    <div className="xchat-templates-strip__cards-tail">
      <button
        aria-expanded={seeAllOpen}
        className="xchat-templates-strip__see-all"
        type="button"
        onClick={() => setSeeAllOpen((o) => !o)}
      >
        {seeAllOpen ? (
          <>
            Show less <span aria-hidden>⋯</span>
          </>
        ) : (
          <>
            See all <span aria-hidden>⋯</span>
          </>
        )}
      </button>
      <div ref={moreWrapRef} className="xchat-templates-strip__more-wrap">
        <button
          aria-controls={moreMenuId}
          aria-expanded={moreMenuOpen}
          aria-haspopup="menu"
          aria-label="More template actions"
          className="xchat-templates-strip__icon-btn xchat-templates-strip__icon-btn--more"
          type="button"
          onClick={() => setMoreMenuOpen((v) => !v)}
        >
          <MoreGlyph />
        </button>
        <AnimatePresence>
          {moreMenuOpen ? (
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              aria-label="Template actions"
              className="xchat-templates-strip__more-menu"
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              id={moreMenuId}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              role="menu"
              transition={{ duration: 0.15 }}
            >
              <button
                className="xchat-templates-strip__more-item"
                role="menuitem"
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  openSaveDialog();
                }}
              >
                Save prompt to library
              </button>
              <button
                className="xchat-templates-strip__more-item"
                role="menuitem"
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setSearchVisible((prev) => {
                    const next = !prev;
                    if (!prev) {
                      setSeeAllOpen(true);
                    }
                    return next;
                  });
                }}
              >
                {searchVisible ? "Hide template search" : "Search library"}
              </button>
              <button
                className="xchat-templates-strip__more-item"
                role="menuitem"
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setSeeAllOpen((o) => !o);
                }}
              >
                {seeAllOpen ? "Collapse template grid" : "See all templates"}
              </button>
              <button
                className="xchat-templates-strip__more-item"
                role="menuitem"
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  hnwiV21SlugForNextAskRef.current = null;
                  setInput("");
                  queueMicrotask(() => composerRef.current?.focus());
                }}
              >
                Write custom prompt
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <motion.section aria-label="Prompt templates" className="xchat-templates-strip" initial={false}>
      <div className="xchat-templates-strip__top-row">
        <div className="xchat-templates-strip__header-main">
          <span
            aria-hidden
            className={`xchat-workspace-bar__pulse${askInFlight ? " xchat-workspace-bar__pulse--live" : ""}`}
          />
          <button
            aria-expanded={libraryExpanded}
            className="xchat-templates-strip__collapse-toggle"
            type="button"
            onClick={() => {
              setLibraryExpanded((prev) => {
                if (!prev) {
                  setSeeAllOpen(false);
                }
                return !prev;
              });
            }}
          >
            <span className="xchat-templates-strip__library-heading">Workspace library</span>
            <span className="xchat-templates-strip__ready-badge" aria-live="polite">
              · {askInFlight ? "compiling…" : `${mergedTemplates.length} ready`}
            </span>
            <span
              aria-hidden
              className={`xchat-templates-strip__collapse-chevron${libraryExpanded ? " xchat-templates-strip__collapse-chevron--expanded" : ""}`}
            >
              ▾
            </span>
          </button>
        </div>
        {libraryExpanded ? (
          <div className="xchat-templates-strip__header-actions">{templatesRowTail}</div>
        ) : null}
      </div>

      {!libraryExpanded ? null : userLoadFailed ? (
        <p className="xchat-templates-strip__hint xchat-templates-strip__hint--muted" role="status">
          Sign in to save custom templates.
        </p>
      ) : null}

      {!libraryExpanded ? null : searchVisible ? (
        <div className="xchat-templates-strip__search-row">
          <label className="sr-only" htmlFor={searchId}>
            Filter templates
          </label>
          <input
            autoCapitalize="sentences"
            className="xchat-templates-strip__search-input"
            enterKeyHint="search"
            id={searchId}
            placeholder="Search templates…"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}

      {!libraryExpanded ? null : seeAllOpen ? (
        <div className="xchat-templates-strip__grid-full">
          {filtered.map((t) => {
            const hnwiKey =
              t.hnwiV21Slug != null && isHnwiPromptTemplateV21Slug(t.hnwiV21Slug)
                ? t.hnwiV21Slug
                : null;
            const optionsDeskHighlight = hnwiKey === "hnwi-v21-options-desk";
            return (
            <div key={t.id} className="xchat-templates-strip__card-wrap">
              <button
                aria-busy={hnwiKey !== null && busyHnwiSlug === hnwiKey}
                aria-label={`${t.title}. ${t.subtitle}`}
                className={`xchat-templates-strip__grid-card${optionsDeskHighlight ? " xchat-templates-strip__card--options-desk" : ""}`}
                disabled={askInFlight || (hnwiKey !== null && Boolean(busyHnwiSlug))}
                type="button"
                onClick={() => void applyTemplate(t)}
              >
                <span className="xchat-templates-strip__grid-card-title">{t.title}</span>
                <span className="xchat-templates-strip__grid-card-meta">{t.subtitle}</span>
              </button>
              {t.savedDocId ? (
                <button
                  aria-label={`Delete saved template ${t.title}`}
                  className="xchat-templates-strip__card-delete"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeSaved(t.savedDocId!);
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
            );
          })}
          <button
            aria-label="Custom prompt — clear composer and write your own message"
            className="xchat-templates-strip__grid-card xchat-templates-strip__grid-card--add"
            type="button"
            onClick={() => {
              hnwiV21SlugForNextAskRef.current = null;
              setInput("");
              queueMicrotask(() => composerRef.current?.focus());
            }}
          >
            <span aria-hidden className="xchat-templates-strip__card-add-icon">
              +
            </span>
            <span className="xchat-templates-strip__grid-card-title">Custom prompt</span>
            <span className="xchat-templates-strip__grid-card-meta">Write your own</span>
          </button>
          <div className="xchat-templates-strip__tail-slot">{templatesRowTail}</div>
        </div>
      ) : libraryExpanded ? (
        <div className="xchat-templates-strip__cards-row xchat-templates-strip__cards-row--compact">
          <div
            ref={scrollerRef}
            aria-label="Workspace prompt shortcuts — use arrow keys when focused to scroll horizontally"
            className="xchat-templates-strip__scroller xchat-templates-strip__scroller--pills"
            role="group"
            tabIndex={0}
            onKeyDown={onScrollerKeyDown}
          >
            {scrollerTemplates.map((t) => {
              const hnwiKey =
                t.hnwiV21Slug != null && isHnwiPromptTemplateV21Slug(t.hnwiV21Slug)
                  ? t.hnwiV21Slug
                  : null;
              const optionsDeskHighlight = hnwiKey === "hnwi-v21-options-desk";
              return (
              <div key={t.id} className="xchat-templates-strip__card-wrap xchat-templates-strip__card-wrap--scroll">
                <button
                  aria-busy={hnwiKey !== null && busyHnwiSlug === hnwiKey}
                  aria-label={`${t.title}. ${t.subtitle}`}
                  className={`xchat-templates-strip__card xchat-templates-strip__card--pill${optionsDeskHighlight ? " xchat-templates-strip__card--options-desk" : ""}`}
                  disabled={askInFlight || (hnwiKey !== null && Boolean(busyHnwiSlug))}
                  type="button"
                  onClick={() => void applyTemplate(t)}
                >
                  <span className="xchat-templates-strip__card-title">{t.title}</span>
                  <span className="xchat-templates-strip__card-meta xchat-templates-strip__sr-only">
                    {t.subtitle}
                  </span>
                </button>
                {t.savedDocId ? (
                  <button
                    aria-label={`Delete saved template ${t.title}`}
                    className="xchat-templates-strip__card-delete xchat-templates-strip__card-delete--scroll"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeSaved(t.savedDocId!);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              );
            })}
            <button
              aria-label="Custom prompt — clear composer and write your own message"
              className="xchat-templates-strip__card xchat-templates-strip__card--pill xchat-templates-strip__card--add"
              type="button"
              onClick={() => {
                hnwiV21SlugForNextAskRef.current = null;
                setInput("");
                queueMicrotask(() => composerRef.current?.focus());
              }}
            >
              <span aria-hidden className="xchat-templates-strip__card-add-icon">
                +
              </span>
              <span className="xchat-templates-strip__card-title">Custom prompt</span>
              <span className="xchat-templates-strip__card-meta xchat-templates-strip__sr-only">
                Write your own
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {libraryExpanded ? (
        <p className="xchat-templates-strip__footnote" role="note" title="Curated + saved prompts — review before Send. Depth (Fast / Expert / Heavy) controls plan-aware multi-agent runs.">
          <span className="xchat-templates-strip__footnote-inner">
            Curated + saved prompts — review before Send · Depth (Fast / Expert / Heavy) for multi-agent runs ·{" "}
            <a className="xchat-templates-strip__doc-link" href="/resources/guides">
              guides
            </a>
          </span>
        </p>
      ) : null}

      {saveOpen ? (
        <div
          aria-labelledby={saveHeadingId}
          aria-modal="true"
          className="xchat-templates-strip__modal-root"
          role="dialog"
        >
          <button
            aria-label="Close save template dialog"
            className="xchat-templates-strip__modal-backdrop"
            type="button"
            onClick={() => setSaveOpen(false)}
          />
          <div className="xchat-templates-strip__modal">
            <h2 className="xchat-templates-strip__modal-title" id={saveHeadingId}>
              Save template
            </h2>
            <label className="xchat-templates-strip__modal-label" htmlFor={saveTitleFieldId}>
              Title
            </label>
            <input
              className="xchat-templates-strip__modal-input"
              id={saveTitleFieldId}
              maxLength={80}
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
            />
            <label className="xchat-templates-strip__modal-label" htmlFor={savePromptFieldId}>
              Prompt
            </label>
            <textarea
              className="xchat-templates-strip__modal-textarea"
              id={savePromptFieldId}
              maxLength={4000}
              rows={5}
              value={savePrompt}
              onChange={(e) => setSavePrompt(e.target.value)}
            />
            {saveError ? <p className="xchat-templates-strip__modal-err">{saveError}</p> : null}
            <div className="xchat-templates-strip__modal-actions">
              <button
                className="xchat-templates-strip__modal-btn xchat-templates-strip__modal-btn--ghost"
                disabled={saveBusy}
                type="button"
                onClick={() => setSaveOpen(false)}
              >
                Cancel
              </button>
              <button
                className="xchat-templates-strip__modal-btn xchat-templates-strip__modal-btn--primary"
                disabled={saveBusy || savePrompt.trim().length < 1}
                type="button"
                onClick={() => void submitSave()}
              >
                {saveBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}

function MoreGlyph() {
  return (
    <svg aria-hidden fill="currentColor" height={16} viewBox="0 0 24 24" width={16}>
      <circle cx={5} cy={12} r={2} />
      <circle cx={12} cy={12} r={2} />
      <circle cx={19} cy={12} r={2} />
    </svg>
  );
}
