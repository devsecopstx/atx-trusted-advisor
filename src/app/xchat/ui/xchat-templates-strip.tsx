"use client";

import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type RefObject
} from "react";

import { AnimatePresence, motion } from "framer-motion";

import {
    applyXchatScanOptionsPrompt,
    XchatTemplatesWorkspaceBar
} from "@/app/xchat/ui/xchat-templates-workspace-bar";
import {
    filterXchatPromptTemplates,
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
};

export function XchatTemplatesStrip({
  composerRef,
  setInput,
  composerDraft,
  initiallyExpanded = false,
  askInFlight = false
}: XchatTemplatesStripProps) {
  const searchId = useId();
  const saveHeadingId = useId();
  const saveTitleFieldId = useId();
  const savePromptFieldId = useId();
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(initiallyExpanded);
  const [seeAllOpen, setSeeAllOpen] = useState(initiallyExpanded);
  const [userRows, setUserRows] = useState<UserTemplateRow[]>([]);
  const [userLoadFailed, setUserLoadFailed] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [savePrompt, setSavePrompt] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreWrapRef = useRef<HTMLDivElement>(null);
  const moreMenuId = useId();

  useEffect(() => {
    if (!moreMenuOpen) {
      return;
    }
    function onDocMouseDown(e: MouseEvent) {
      if (!moreWrapRef.current?.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
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

  const scrollerTemplates = filtered.slice(0, 4);

  function applyTemplate(t: StripTemplate) {
    setInput(t.prompt);
    queueMicrotask(() => {
      const el = composerRef.current;
      if (el) {
        el.focus();
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
      }
    });
  }

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
        {seeAllOpen ? "Show less" : "See all"}
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
      <XchatTemplatesWorkspaceBar askInFlight={askInFlight} promptLibraryCount={mergedTemplates.length} />
      <div className="xchat-templates-strip__header">
        <span className="xchat-templates-strip__title">Templates</span>
      </div>

      {userLoadFailed ? (
        <p className="xchat-templates-strip__hint xchat-templates-strip__hint--muted" role="status">
          Sign in to save custom templates.
        </p>
      ) : null}

      {searchVisible ? (
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

      {seeAllOpen ? (
        <div className="xchat-templates-strip__grid-full">
          <button
            aria-busy={askInFlight}
            aria-label="Insert scan my options prompt into composer, then review and send"
            className="xchat-templates-strip__grid-card xchat-templates-strip__grid-card--scan"
            disabled={askInFlight}
            type="button"
            onClick={() => applyXchatScanOptionsPrompt(setInput, composerRef)}
          >
            <span className="xchat-templates-strip__grid-card-title">Scan my options</span>
            <span className="xchat-templates-strip__grid-card-meta">Holdings + watchlist</span>
          </button>
          {filtered.map((t) => (
            <div key={t.id} className="xchat-templates-strip__card-wrap">
              <button
                className="xchat-templates-strip__grid-card"
                type="button"
                onClick={() => applyTemplate(t)}
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
          ))}
          <button
            className="xchat-templates-strip__grid-card xchat-templates-strip__grid-card--add"
            type="button"
            onClick={() => {
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
      ) : (
        <div className="xchat-templates-strip__cards-row">
          <div className="xchat-templates-strip__scroller">
            <div className="xchat-templates-strip__card-wrap xchat-templates-strip__card-wrap--scroll">
            <button
              aria-busy={askInFlight}
              aria-label="Insert scan my options prompt into composer, then review and send"
              className="xchat-templates-strip__card xchat-templates-strip__card--scan"
              disabled={askInFlight}
              type="button"
              onClick={() => applyXchatScanOptionsPrompt(setInput, composerRef)}
            >
              <span className="xchat-templates-strip__card-title">Scan my options</span>
              <span className="xchat-templates-strip__card-meta">Holdings + watchlist</span>
            </button>
            </div>
            {scrollerTemplates.map((t) => (
              <div key={t.id} className="xchat-templates-strip__card-wrap xchat-templates-strip__card-wrap--scroll">
              <button
                className="xchat-templates-strip__card"
                type="button"
                onClick={() => applyTemplate(t)}
              >
                <span className="xchat-templates-strip__card-title">{t.title}</span>
                <span className="xchat-templates-strip__card-meta">{t.subtitle}</span>
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
            ))}
            <button
              className="xchat-templates-strip__card xchat-templates-strip__card--add"
              type="button"
              onClick={() => {
                setInput("");
                queueMicrotask(() => composerRef.current?.focus());
              }}
            >
              <span aria-hidden className="xchat-templates-strip__card-add-icon">
                +
              </span>
              <span className="xchat-templates-strip__card-title">Custom prompt</span>
              <span className="xchat-templates-strip__card-meta">Write your own</span>
            </button>
          </div>
          {templatesRowTail}
        </div>
      )}

      <p className="xchat-templates-strip__footnote" role="note" title="Curated + saved prompts — review before Send. Depth (Fast / Expert / Heavy) controls plan-aware multi-agent runs.">
        <span className="xchat-templates-strip__footnote-inner">
          Curated + saved prompts — review before Send · Depth (Fast / Expert / Heavy) for multi-agent runs ·{" "}
          <a className="xchat-templates-strip__doc-link" href="/resources/guides">
            guides
          </a>
        </span>
      </p>

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
