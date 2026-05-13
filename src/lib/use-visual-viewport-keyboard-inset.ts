"use client";

import { useEffect, useState } from "react";

/**
 * Bottom overlap (px) when the virtual keyboard shrinks `visualViewport`
 * (iOS Safari / in-app browsers / some Android Chrome).
 */
export function useVisualViewportKeyboardInset(): number {
  const [insetPx, setInsetPx] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) {
      return;
    }
    const update = () => {
      const visibleBottom = vv.offsetTop + vv.height;
      const raw = window.innerHeight - visibleBottom;
      setInsetPx(Math.max(0, Math.round(raw)));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return insetPx;
}
