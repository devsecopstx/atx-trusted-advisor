"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type SVGProps
} from "react";
import { createPortal } from "react-dom";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import {
    LucideBookOpenIcon,
    LucideSettingsIcon,
    LucideSquarePenIcon,
    WorkspaceSignOutIcon
} from "@/app/ui/lucide-product-icons";
import { GoogleGIcon } from "@/app/ui/oauth-provider-icons";
import { RailUserFeedbackDialog } from "@/app/ui/rail-user-feedback-dialog";
import { SidebarDestructiveAction } from "@/app/ui/sidebar-destructive-action";
import { useTenantShellBranding } from "@/app/ui/tenant-branding-context";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { USER_FEEDBACK_OPEN_EVENT } from "@/lib/user-feedback-open-event";

function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ProfileGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

/** Card stack — billing / plans row (Lucide credit-card–style stroke). */
function PlansBillingGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <rect
        height="14"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth={1.75}
        width="20"
        x="2"
        y="5"
      />
      <path d="M2 10h20" stroke="currentColor" strokeWidth={1.75} />
    </svg>
  );
}

function AdminHubGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 14h7v6H4v-6zm9 0h7v6h-7v-6z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function MenuChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`workspace-profile-footer-menu__chevron${open ? " workspace-profile-footer-menu__chevron--open" : ""}`}
      fill="none"
      height={18}
      viewBox="0 0 24 24"
      width={18}
    >
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

export type WorkspaceProfileFooterMenuProps = {
  accountDetails: AppUserRailAccountPanelDetails;
  showWideSidebarChrome: boolean;
  feedbackPageLabel?: string;
  googleLinkHref?: string | null;
  isPathVisible: (pathPrefix: string) => boolean;
  isGlobalAdmin: boolean;
  showReferenceDocs: boolean;
};

export function WorkspaceProfileFooterMenu({
  accountDetails,
  showWideSidebarChrome,
  feedbackPageLabel,
  googleLinkHref = null,
  isPathVisible,
  isGlobalAdmin,
  showReferenceDocs
}: WorkspaceProfileFooterMenuProps) {
  const pathname = usePathname() ?? "";
  const branding = useTenantShellBranding();
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [signOutShortcutOpen, setSignOutShortcutOpen] = useState(false);
  const consumeShortcutOpen = useCallback(() => setSignOutShortcutOpen(false), []);

  const displayName =
    accountDetails.displayName?.trim() || accountDetails.username?.trim() || "Account";
  const subtitle =
    branding?.displayName?.trim() || `@${accountDetails.username?.trim() || "account"}`;
  const pageLabel = feedbackPageLabel?.trim() || pathname || "App";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal targets document.body after hydration
    setMounted(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close profile menu on in-app navigation
    setMenuOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) {
      return;
    }
    function measure() {
      if (triggerRef.current) {
        setAnchorRect(triggerRef.current.getBoundingClientRect());
      }
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [menuOpen]);

  useFocusTrap(menuOpen && Boolean(anchorRect), panelRef);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
      setSignOutShortcutOpen(true);
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

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const openFeedback = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new CustomEvent(USER_FEEDBACK_OPEN_EVENT));
  }, [closeMenu]);

  const gapPx = 10;
  const panelMinW = 248;
  const panelReady = menuOpen && anchorRect && typeof window !== "undefined";
  const panelPosition =
    panelReady && anchorRect
      ? {
          left: Math.max(
            8,
            Math.min(anchorRect.left, window.innerWidth - Math.max(panelMinW, anchorRect.width) - 8)
          ),
          bottom: window.innerHeight - anchorRect.top + gapPx,
          width: Math.max(panelMinW, anchorRect.width)
        }
      : null;

  const motionPreset = reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="workspace-profile-footer-menu">
      <button
        ref={triggerRef}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className={`workspace-profile-footer-menu__trigger xf-focus-ring--sidebar${showWideSidebarChrome ? "" : " workspace-profile-footer-menu__trigger--icon-only"}`}
        type="button"
        onClick={() => {
          setAnchorRect(null);
          setMenuOpen((o) => !o);
        }}
      >
        <span className="workspace-profile-footer-menu__avatar-wrap">
          {accountDetails.avatarUrl?.trim() ? (
            <Image
              alt=""
              aria-hidden
              className="workspace-profile-footer-menu__avatar"
              height={36}
              src={accountDetails.avatarUrl}
              unoptimized
              width={36}
            />
          ) : (
            <ProfileGlyph className="workspace-profile-footer-menu__avatar-fallback" />
          )}
        </span>
        {showWideSidebarChrome ? (
          <>
            <span className="workspace-profile-footer-menu__identity">
              <span className="workspace-profile-footer-menu__name">{displayName}</span>
              <span className="workspace-profile-footer-menu__sub">{subtitle}</span>
            </span>
            <MenuChevron open={menuOpen} />
          </>
        ) : (
          <span className="sr-only">Open profile menu</span>
        )}
      </button>

      <RailUserFeedbackDialog pageLabel={pageLabel} />

      {mounted && typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {panelReady && panelPosition ? (
                <>
                  <motion.button
                    key="workspace-profile-backdrop"
                    animate={{ opacity: 1 }}
                    aria-label="Close profile menu"
                    className="workspace-profile-footer-menu__backdrop"
                    exit={{ opacity: 0 }}
                    initial={reduceMotion ? undefined : { opacity: 0 }}
                    transition={motionPreset}
                    type="button"
                    onClick={closeMenu}
                  />
                  <motion.div
                    key="workspace-profile-panel"
                    ref={panelRef}
                    animate={{ opacity: 1, y: 0 }}
                    aria-label="Profile and workspace actions"
                    className="workspace-profile-footer-menu__panel xf-focus-ring--sidebar"
                    exit={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                    initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
                    role="menu"
                    style={{
                      left: panelPosition.left,
                      bottom: panelPosition.bottom,
                      width: panelPosition.width
                    }}
                    transition={motionPreset}
                  >
                    <div className="workspace-profile-footer-menu__section workspace-profile-footer-menu__section--header">
                      <div className="workspace-profile-footer-menu__header-avatar">
                        {accountDetails.avatarUrl?.trim() ? (
                          <Image
                            alt=""
                            aria-hidden
                            className="workspace-profile-footer-menu__header-avatar-img"
                            height={36}
                            src={accountDetails.avatarUrl}
                            unoptimized
                            width={36}
                          />
                        ) : (
                          <ProfileGlyph className="h-8 w-8 text-[var(--xf-text-300)]" />
                        )}
                      </div>
                      <div className="workspace-profile-footer-menu__header-text">
                        <span className="workspace-profile-footer-menu__header-name">{displayName}</span>
                        <span className="workspace-profile-footer-menu__header-sub">{subtitle}</span>
                      </div>
                    </div>
                    <div className="workspace-profile-footer-menu__rule" role="separator" />
                    <Link
                      className="workspace-profile-footer-menu__row"
                      href="/account/billing"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      <ProfileGlyph className="workspace-profile-footer-menu__row-icon" />
                      Profile
                    </Link>
                    <Link className="workspace-profile-footer-menu__row" href="/legal/terms" role="menuitem" onClick={closeMenu}>
                      <LucideBookOpenIcon className="workspace-profile-footer-menu__row-icon" />
                      Legal
                    </Link>
                    {isPathVisible("/resources") ? (
                      <Link
                        className="workspace-profile-footer-menu__row"
                        href="/resources/guides"
                        role="menuitem"
                        onClick={closeMenu}
                      >
                        <LucideBookOpenIcon className="workspace-profile-footer-menu__row-icon" />
                        Resources
                      </Link>
                    ) : null}
                    <button
                      className="workspace-profile-footer-menu__row"
                      role="menuitem"
                      type="button"
                      onClick={openFeedback}
                    >
                      <LucideSquarePenIcon className="workspace-profile-footer-menu__row-icon" />
                      Feedback
                    </button>
                    {isGlobalAdmin ? (
                      <Link
                        className="workspace-profile-footer-menu__row"
                        href="/admin/manage_account"
                        role="menuitem"
                        onClick={closeMenu}
                      >
                        <LucideSettingsIcon className="workspace-profile-footer-menu__row-icon" />
                        Settings
                      </Link>
                    ) : null}
                    {isGlobalAdmin && showReferenceDocs ? (
                      <Link
                        className="workspace-profile-footer-menu__row"
                        href="/admin/api-docs"
                        role="menuitem"
                        onClick={closeMenu}
                      >
                        <LucideBookOpenIcon className="workspace-profile-footer-menu__row-icon" />
                        Reference docs
                      </Link>
                    ) : null}
                    {isGlobalAdmin ? (
                      <Link className="workspace-profile-footer-menu__row" href="/admin" role="menuitem" onClick={closeMenu}>
                        <AdminHubGlyph className="workspace-profile-footer-menu__row-icon" />
                        Admin hub
                      </Link>
                    ) : null}
                    {googleLinkHref ? (
                      <Link
                        className="workspace-profile-footer-menu__row"
                        href={googleLinkHref}
                        role="menuitem"
                        onClick={closeMenu}
                      >
                        <GoogleGIcon className="workspace-profile-footer-menu__row-icon--google" size={18} />
                        Link Google
                      </Link>
                    ) : null}
                    <Link
                      className="workspace-profile-footer-menu__row"
                      href="/account/billing"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      <PlansBillingGlyph className="workspace-profile-footer-menu__row-icon" />
                      Plans &amp; billing
                    </Link>
                    <div className="workspace-profile-footer-menu__rule" role="separator" />
                    <div className="workspace-profile-footer-menu__signout-wrap">
                      <SidebarDestructiveAction
                        ariaLabel="Sign out of aTx Finance"
                        cancelLabel="Cancel"
                        compact={false}
                        confirmActionLabel="Yes, sign out"
                        confirmMessage="You will be signed out of aTx Finance. Any unsaved work in this browser session may be lost."
                        confirmTitle="Sign out?"
                        icon={<WorkspaceSignOutIcon className="h-[18px] w-[18px] shrink-0" />}
                        label="Sign out"
                        openSignal={signOutShortcutOpen}
                        triggerClassName="workspace-profile-footer-menu__signout-trigger"
                        variant="destructive-soft"
                        onConfirm={performLogout}
                        onOpenSignalConsumed={consumeShortcutOpen}
                      />
                    </div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
