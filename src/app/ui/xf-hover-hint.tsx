"use client";

import { createPortal } from "react-dom";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode
} from "react";

type XfHoverHintProps = {
  hint: string;
  /** Single interactive element (button, link, etc.) — receives merged handlers when possible. */
  children: ReactNode;
  className?: string;
};

/**
 * Theme-safe hover/focus hints: native `title` tooltips follow OS chrome and often disappear on xf-ui soft/deep.
 * This renders a fixed portal bubble using `--xf-*` tokens so text stays readable in Light and Dark shells.
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

  if (isValidElement(children)) {
    const child = children as ReactElement<{
      onMouseEnter?: (e: unknown) => void;
      onMouseLeave?: (e: unknown) => void;
      onFocus?: (e: unknown) => void;
      onBlur?: (e: unknown) => void;
      className?: string;
    }>;
    return (
      <>
        <span className={className ? `xf-hover-hint ${className}` : "xf-hover-hint"} ref={wrapRef}>
          {cloneElement(child, {
            className: [child.props.className, "xf-hover-hint__target"].filter(Boolean).join(" "),
            onMouseEnter: (e: unknown) => {
              child.props.onMouseEnter?.(e);
              show();
            },
            onMouseLeave: (e: unknown) => {
              child.props.onMouseLeave?.(e);
              hide();
            },
            onFocus: (e: unknown) => {
              child.props.onFocus?.(e);
              show();
            },
            onBlur: (e: unknown) => {
              child.props.onBlur?.(e);
              hide();
            }
          })}
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

  return (
    <span
      ref={wrapRef}
      className={className ? `xf-hover-hint ${className}` : "xf-hover-hint"}
      onBlur={hide}
      onFocus={show}
      onMouseEnter={show}
      onMouseLeave={hide}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Escape") {
          hide();
        }
      }}
      tabIndex={-1}
    >
      {children}
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
    </span>
  );
}
