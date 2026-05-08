"use client";

import type { SVGProps } from "react";
import { useCallback } from "react";

import { LucideMonitorIcon } from "@/app/ui/lucide-product-icons";
import { THEME_OPTIONS, useXfShellTheme } from "@/app/ui/public-theme-picker";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import type { XfUiThemePreference } from "@/lib/xf-ui-theme";

function SunIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" className={className} {...props}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={1.75} />
      <path
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32L19.07 4.93"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

function MoonIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" className={className} {...props}>
      <path
        d="M21 14.5A8.5 8.5 0 0111.5 5a8.45 8.45 0 013.14 6.32 3.5 3.5 0 00-4.18 4.18A8.5 8.5 0 0021 14.5z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

function themeIcon(value: XfUiThemePreference, className: string) {
  if (value === "light") {
    return <SunIcon className={className} />;
  }
  if (value === "dark") {
    return <MoonIcon className={className} />;
  }
  return <LucideMonitorIcon className={className} />;
}

type WorkspaceRailAppearanceProps = {
  /** Compact strip under top-nav tenant chrome (vs workspace rail footer). */
  variant?: "rail" | "header";
};

export function WorkspaceRailAppearance({ variant = "rail" }: WorkspaceRailAppearanceProps) {
  const { pref, setPreference } = useXfShellTheme();

  const pick = useCallback(
    (next: XfUiThemePreference) => {
      setPreference(next);
    },
    [setPreference]
  );

  const iconCls = variant === "header" ? "h-[1rem] w-[1rem]" : "h-[1.125rem] w-[1.125rem]";
  const labelId =
    variant === "header" ? "workspace-header-appearance-label" : "workspace-rail-appearance-label";
  const rootCls =
    variant === "header"
      ? "workspace-rail-appearance workspace-rail-appearance--header"
      : "workspace-rail-appearance";

  return (
    <div className={rootCls}>
      <p className="workspace-rail-appearance__heading sr-only" id={labelId}>
        Appearance
      </p>
      <div aria-labelledby={labelId} className="workspace-rail-appearance__group" role="radiogroup">
        {THEME_OPTIONS.map((opt) => {
          const selected = pref === opt.value;
          const mods = ["workspace-rail-appearance__btn", selected ? "workspace-rail-appearance__btn--active" : ""]
            .filter(Boolean)
            .join(" ");
          const btn = (
            <button
              aria-checked={selected}
              aria-label={opt.label}
              className={mods}
              role="radio"
              type="button"
              onClick={() => pick(opt.value)}
            >
              <span className="workspace-rail-appearance__btn-icon">{themeIcon(opt.value, iconCls)}</span>
            </button>
          );
          return (
            <XfHoverHint hint={opt.hint} key={opt.value}>
              {btn}
            </XfHoverHint>
          );
        })}
      </div>
    </div>
  );
}
