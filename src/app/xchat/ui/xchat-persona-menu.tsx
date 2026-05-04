"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { compactPersonaOptionLabel } from "@/app/xchat/ui/xchat-persona-label";

export type XchatPersonaMenuRow = {
  _id: string;
  name: string;
  previewLine?: string;
};

export type XchatPersonaMenuProps = {
  rows: XchatPersonaMenuRow[];
  selectedPersonaId: string;
  onSelectPersonaId: (id: string) => void;
  disabled?: boolean;
  errorMessage?: string | null;
};

export function XchatPersonaMenu({
  rows,
  selectedPersonaId,
  onSelectPersonaId,
  disabled = false,
  errorMessage = null
}: XchatPersonaMenuProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active =
    rows.find((r) => r._id === selectedPersonaId)?.name ??
    (selectedPersonaId ? "Persona" : "Auto");
  const triggerLabel = compactPersonaOptionLabel(active);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string) {
    onSelectPersonaId(id);
    setOpen(false);
  }

  function onTriggerKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    }
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  }

  if (disabled) {
    return (
      <div className="xchat-persona-menu xchat-persona-menu--disabled">
        <button
          aria-disabled
          className="xchat-persona-menu__trigger"
          disabled
          type="button"
        >
          <span className="xchat-persona-menu__trigger-label">{triggerLabel}</span>
          <ChevronIcon />
        </button>
        {errorMessage ? (
          <span className="xchat-persona-menu__error" role="status">
            {errorMessage}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="xchat-persona-menu" ref={rootRef}>
      <button
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="xchat-persona-menu__trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="xchat-persona-menu__trigger-label">{triggerLabel}</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div className="xchat-persona-menu__popover" id={listboxId} role="listbox">
          <button
            aria-selected={selectedPersonaId === ""}
            className={`xchat-persona-menu__option${selectedPersonaId === "" ? " xchat-persona-menu__option--active" : ""}`}
            role="option"
            type="button"
            onClick={() => pick("")}
          >
            <span className="xchat-persona-menu__option-title">Auto</span>
            <span className="xchat-persona-menu__option-desc">
              Tenant default persona for this thread
            </span>
          </button>
          {rows.map((r) => (
            <button
              key={r._id}
              aria-selected={selectedPersonaId === r._id}
              className={`xchat-persona-menu__option${selectedPersonaId === r._id ? " xchat-persona-menu__option--active" : ""}`}
              role="option"
              type="button"
              onClick={() => pick(r._id)}
            >
              <span className="xchat-persona-menu__option-title">{r.name}</span>
              {r.previewLine ? (
                <span className="xchat-persona-menu__option-desc">{r.previewLine}</span>
              ) : (
                <span className="xchat-persona-menu__option-desc">Published workspace persona</span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      aria-hidden
      className={`xchat-persona-menu__chevron${open ? " xchat-persona-menu__chevron--open" : ""}`}
      fill="none"
      height={14}
      viewBox="0 0 24 24"
      width={14}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}
