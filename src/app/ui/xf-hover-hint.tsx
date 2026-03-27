"use client";

import {
    cloneElement,
    isValidElement,
    useCallback,
    useRef,
    useState,
    type FocusEvent,
    type KeyboardEvent,
    type MouseEvent,
    type ReactElement,
    type ReactNode
} from "react";
import { createPortal } from "react-dom";

type XfHoverHintProps = {
  hint: string;
  children: ReactNode;
  className?: string;
};

/**
 * Theme-safe hover/focus hints: native `title` follows OS chrome and is often unreadable on xf-ui soft/deep.
 * Wrapper uses mouseover/out + focus capture so hints work over disabled controls and clipped rails.
 */
export function XfHoverHint({ hint, children, className }: XfHoverHintProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLSpanElement>(null);

  const updatePos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    setPos({ top: r.top - 6, left: r.left + r.width / 2 });
  }, []);

  const show = useCallback(() => {
    updatePos();
    setOpen(true);
  }, [updatePos]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  const onMouseOver = useCallback(() => {
    show();
  }, [show]);

  const onMouseOut = useCallback(
    (e: MouseEvent<HTMLSpanElement>) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !e.currentTarget.contains(next)) {
        hide();
      }
    },
    [hide]
  );

  const onFocusCapture = useCallback(() => {
    show();
  }, [show]);

  const onBlurCapture = useCallback(
    (e: FocusEvent<HTMLSpanElement>) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !e.currentTarget.contains(next)) {
        hide();
      }
    },
    [hide]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === "Escape") {
        hide();
      }
    },
    [hide]
  );

  const inner = isValidElement(children)
    ? cloneElement(children as ReactElement<{ className?: string }>, {
        className: [(children as ReactElement<{ className?: string }>).props.className, "xf-hover-hint__target"]
          .filter(Boolean)
          .join(" ")
      })
    : children;

  return (
    <>
      <span
        ref={wrapRef}
        className={className ? `xf-hover-hint ${className}` : "xf-hover-hint"}
        onBlurCapture={onBlurCapture}
        onFocusCapture={onFocusCapture}
        onKeyDown={onKeyDown}
        onMouseOut={onMouseOut}
        onMouseOver={onMouseOver}
      >
        {inner}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="xf-hover-hint__bubble"
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
            >
              {hint}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
