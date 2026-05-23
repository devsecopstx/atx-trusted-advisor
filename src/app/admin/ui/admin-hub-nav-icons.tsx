import type { ReactNode, SVGProps } from "react";

export type AdminHubIconKey =
  | "users"
  | "portfolio"
  | "persona"
  | "calendar"
  | "settings"
  | "chat"
  | "batch"
  | "marketing"
  | "delivery"
  | "books"
  | "shield"
  | "audit"
  | "hub";

function strokeIcon(paths: ReactNode, props: SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...rest}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}>
        {paths}
      </g>
    </svg>
  );
}

const ICONS: Record<AdminHubIconKey, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  hub: (props) =>
    strokeIcon(
      <>
        <path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
      </>,
      props
    ),
  users: (props) =>
    strokeIcon(
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>,
      props
    ),
  portfolio: (props) =>
    strokeIcon(
      <>
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.89l-.812-1.22A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </>,
      props
    ),
  persona: (props) =>
    strokeIcon(
      <>
        <path d="M12 8V4H8" />
        <rect height="12" width="12" x="8" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 2v2" />
        <path d="M9 2v2" />
      </>,
      props
    ),
  calendar: (props) =>
    strokeIcon(
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect height="18" width="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
      </>,
      props
    ),
  settings: (props) =>
    strokeIcon(
      <>
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </>,
      props
    ),
  chat: (props) =>
    strokeIcon(
      <>
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 3V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </>,
      props
    ),
  batch: (props) =>
    strokeIcon(
      <>
        <path d="M4 14h6v6H4z" />
        <path d="M14 4h6v6h-6z" />
        <path d="M14 14h6v6h-6z" />
        <path d="M4 4h6v6H4z" />
      </>,
      props
    ),
  marketing: (props) =>
    strokeIcon(
      <>
        <path d="m3 11 18-5v12L3 13v-2z" />
        <path d="M11 13 21 8" />
      </>,
      props
    ),
  delivery: (props) =>
    strokeIcon(
      <>
        <path d="M22 12h-6l-2 3H10l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
      </>,
      props
    ),
  books: (props) =>
    strokeIcon(
      <>
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      </>,
      props
    ),
  shield: (props) =>
    strokeIcon(
      <>
        <path d="M20 13c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V5l8-3 8 3z" />
      </>,
      props
    ),
  audit: (props) =>
    strokeIcon(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </>,
      props
    )
};

export function AdminHubNavIcon({
  icon,
  className
}: {
  icon: AdminHubIconKey;
  className?: string;
}) {
  const render = ICONS[icon];
  return render({ className: className ?? "admin-hub-nav-icon" });
}

export const ADMIN_HUB_ITEM_ICONS: Partial<Record<string, AdminHubIconKey>> = {
  "/admin/manage-users": "users",
  "/admin/portfolios": "portfolio",
  "/admin/personas": "persona",
  "/admin/tasks": "calendar",
  "/admin/tenant-preferences": "settings",
  "/xchat": "chat",
  "/admin/batch": "batch",
  "/admin/marketing": "marketing",
  "/admin/delivery-channels": "delivery",
  "/admin/onboarding": "books",
  "/admin/brokers": "books",
  "/admin/broker-import": "books",
  "/admin/tenant-register": "shield",
  "/admin/audit": "audit",
  "/admin/login-audit": "audit",
  "/admin/logins-today": "audit",
  "/admin/xchat-tool-usage": "chat",
  "/admin/manage-backoffice": "settings"
};
