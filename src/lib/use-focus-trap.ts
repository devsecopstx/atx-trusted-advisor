import { type RefObject, useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]),button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]):not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])';

function listFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      !el.closest('[aria-hidden="true"]') &&
      !(el instanceof HTMLAnchorElement && el.getAttribute("href") === "") &&
      el.tabIndex !== -1
  );
}

/**
 * Keeps Tab cycling inside `containerRef` while `active`. Focuses first focusable on activate;
 * restores prior focus on deactivate.
 */
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!active || !containerRef.current) {
      return;
    }
    const root = containerRef.current;
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const initial = listFocusable(root);
    if (initial[0]) {
      initial[0].focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") {
        return;
      }
      const nodes = listFocusable(root);
      if (nodes.length === 0) {
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      if (prev && document.body.contains(prev)) {
        prev.focus();
      }
    };
  }, [active, containerRef]);
}
