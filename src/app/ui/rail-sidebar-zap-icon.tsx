import type { SVGProps } from "react";

export type RailSidebarZapIconProps = SVGProps<SVGSVGElement> & {
  /**
   * `toggle` — top-of-rail expand control when the sidebar is collapsed (larger glyph).
   * `disclosure` — section headers (e.g. Manage workspace) inside the expanded rail.
   */
  size?: "toggle" | "disclosure";
};

/**
 * Shared **yellow lightning** mark for app-user left rail: collapsed-rail expand
 * (`AppUserRailExpandIcon`, xChat rail toggle) and **Manage workspace** (and any future rail
 * affordances). One SVG + `xf-rail-sidebar-zap-icon*` styles in `xchat.css`.
 */
export function RailSidebarZapIcon({
  size = "toggle",
  className = "",
  ...props
}: RailSidebarZapIconProps) {
  const sizeClass =
    size === "disclosure" ? "xf-rail-sidebar-zap-icon--disclosure" : "xf-rail-sidebar-zap-icon--toggle";
  return (
    <svg
      aria-hidden
      className={["xf-rail-sidebar-zap-icon", sizeClass, className].filter(Boolean).join(" ")}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <polygon
        points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.65}
      />
    </svg>
  );
}
