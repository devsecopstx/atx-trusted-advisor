"use client";

import { useCallback, useEffect, useState } from "react";

import { WorkspaceSignOutIcon } from "@/app/ui/lucide-product-icons";
import { SidebarDestructiveAction } from "@/app/ui/sidebar-destructive-action";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

type WorkspaceRailLogoutProps = {
  /** When false, show icon-only trigger + tooltip. */
  railExpanded: boolean;
};

export function WorkspaceRailLogout({ railExpanded }: WorkspaceRailLogoutProps) {
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const consumeShortcutOpen = useCallback(() => setShortcutOpen(false), []);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) {
        return;
      }
      if (e.key.toLowerCase() !== "l") {
        return;
      }
      const el = e.target;
      if (el instanceof HTMLElement) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      setShortcutOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const performLogout = useCallback(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      throw new Error("Sign out failed");
    }
    window.location.href = "/xchat";
  }, []);

  const icon = <WorkspaceSignOutIcon className="h-[18px] w-[18px] shrink-0" />;

  const action = (
    <SidebarDestructiveAction
      ariaLabel="Sign out of aTx Finance"
      cancelLabel="Cancel"
      compact={!railExpanded}
      confirmActionLabel="Yes, sign out"
      confirmMessage="You will be signed out of aTx Finance. Any unsaved strategy jobs or xChat turns in this browser session may be lost."
      confirmTitle="Sign out?"
      icon={icon}
      label="Sign out"
      openSignal={shortcutOpen}
      variant="destructive-soft"
      onConfirm={performLogout}
      onOpenSignalConsumed={consumeShortcutOpen}
    />
  );

  if (!railExpanded) {
    return (
      <div className="workspace-rail-logout workspace-rail-logout--compact">
        <XfHoverHint hint="Sign out">{action}</XfHoverHint>
      </div>
    );
  }

  return <div className="workspace-rail-logout">{action}</div>;
}
