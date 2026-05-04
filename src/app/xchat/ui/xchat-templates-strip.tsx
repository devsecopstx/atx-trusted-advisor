"use client";

import { useId, useMemo, useState, type RefObject } from "react";

import {
    filterXchatPromptTemplates,
    XCHAT_HNWI_PROMPT_TEMPLATES,
    type XchatPromptTemplate
} from "@/modules/xchat/xchat-hnwi-templates";

export type XchatTemplatesStripProps = {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  setInput: (v: string) => void;
  /** Expand gallery + search on first paint (e.g. `?rail=xchat&item=examples`). */
  initiallyExpanded?: boolean;
};

const TOP_ROW_COUNT = 5;

export function XchatTemplatesStrip({
  composerRef,
  setInput,
  initiallyExpanded = false
}: XchatTemplatesStripProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(initiallyExpanded);
  const [seeAllOpen, setSeeAllOpen] = useState(initiallyExpanded);

  const filtered = useMemo(
    () => filterXchatPromptTemplates(XCHAT_HNWI_PROMPT_TEMPLATES, query),
    [query]
  );

  const topRow = filtered.slice(0, TOP_ROW_COUNT);

  function applyTemplate(t: XchatPromptTemplate) {
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

  return (
    <section aria-label="Prompt templates" className="xchat-templates-strip">
      <div className="xchat-templates-strip__header">
        <span className="xchat-templates-strip__title">Templates</span>
        <div className="xchat-templates-strip__header-actions">
          <button
            aria-expanded={searchVisible}
            aria-label={searchVisible ? "Hide template search" : "Search templates"}
            className="xchat-templates-strip__icon-btn"
            type="button"
            onClick={() => {
              setSearchVisible((v) => !v);
              if (!searchVisible) {
                setSeeAllOpen(true);
              }
            }}
          >
            <SearchGlyph />
          </button>
          <button
            aria-label="Focus composer for a custom prompt"
            className="xchat-templates-strip__icon-btn"
            type="button"
            onClick={() => {
              setInput("");
              queueMicrotask(() => composerRef.current?.focus());
            }}
          >
            <PlusGlyph />
          </button>
        </div>
        <button
          aria-expanded={seeAllOpen}
          className="xchat-templates-strip__see-all"
          type="button"
          onClick={() => setSeeAllOpen((o) => !o)}
        >
          {seeAllOpen ? "Show less" : "See all"}
        </button>
      </div>

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
          {filtered.map((t) => (
            <button
              key={t.id}
              className="xchat-templates-strip__grid-card"
              type="button"
              onClick={() => applyTemplate(t)}
            >
              <span className="xchat-templates-strip__grid-card-title">{t.title}</span>
              <span className="xchat-templates-strip__grid-card-meta">{t.subtitle}</span>
            </button>
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
        </div>
      ) : (
        <div className="xchat-templates-strip__scroller">
          {topRow.map((t) => (
            <button
              key={t.id}
              className="xchat-templates-strip__card"
              type="button"
              onClick={() => applyTemplate(t)}
            >
              <span className="xchat-templates-strip__card-title">{t.title}</span>
              <span className="xchat-templates-strip__card-meta">{t.subtitle}</span>
            </button>
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
      )}

      <p className="xchat-templates-strip__footnote" role="note">
        Curated HNWI-style prompts — review before Send. Parallel multi-agent depth is plan-gated on the server (
        <a className="xchat-templates-strip__doc-link" href="/resources/getting-started">
          getting started
        </a>
        ).
      </p>
    </section>
  );
}

function SearchGlyph() {
  return (
    <svg aria-hidden fill="none" height={16} viewBox="0 0 24 24" width={16}>
      <path
        d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM21 21l-4.35-4.35"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg aria-hidden fill="none" height={16} viewBox="0 0 24 24" width={16}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth={2} />
    </svg>
  );
}
