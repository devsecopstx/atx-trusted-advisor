import type { ReactNode } from "react";

import "../../../xchat/xchat.css";

type Props = {
  children: ReactNode;
};

/** Nested under `app_user/xoptions/layout` (footer + shell). Styles-only wrapper. */
export default function XoptionsStrategyBuilderLayout({ children }: Props) {
  return (
    <div className="xchat-layout-root min-h-dvh bg-[color:var(--xf-bg-950,#050505)] text-[color:var(--xf-text-primary,#f1f5f9)]">
      {children}
    </div>
  );
}
