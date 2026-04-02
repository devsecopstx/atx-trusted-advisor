import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";

/** Shared with xChat rail — yellow lightning expand (`RailSidebarZapIcon`), chevrons collapse. */

export function AppUserRailExpandIcon() {
  return <RailSidebarZapIcon size="toggle" />;
}

export function AppUserRailCollapseIcon() {
  return (
    <svg aria-hidden className="app-user-rail-toggle__glyph" fill="none" viewBox="0 0 24 24">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M21 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
