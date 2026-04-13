export type ResolveDesignTokenMode = "color" | "borderTop" | "background";

/**
 * Resolves a CSS custom property to computed `rgb()` / `rgba()` for APIs that require literals (e.g. ApexCharts).
 */
export function resolveDesignTokenColor(
  varName: `--${string}`,
  mode: ResolveDesignTokenMode = "color",
  fallback: string
): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;";
  const ref = `var(${varName})`;
  if (mode === "color") {
    el.style.color = ref;
  } else if (mode === "background") {
    el.style.backgroundColor = ref;
  } else {
    el.style.borderTopWidth = "1px";
    el.style.borderTopStyle = "solid";
    el.style.borderTopColor = ref;
  }
  document.documentElement.appendChild(el);
  const cs = getComputedStyle(el);
  const raw =
    mode === "color" ? cs.color : mode === "background" ? cs.backgroundColor : cs.borderTopColor;
  el.remove();
  if (!raw || raw === "rgba(0, 0, 0, 0)" || raw === "transparent") {
    return fallback;
  }
  return raw;
}
