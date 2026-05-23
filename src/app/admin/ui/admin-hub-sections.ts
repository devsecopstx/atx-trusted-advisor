import { ADMIN_BROKER_IMPORT_DESCRIPTION } from "@/app/admin/lib/broker-import-description";

import type { AdminHubIconKey } from "@/app/admin/ui/admin-hub-nav-icons";

export type AdminFunction = {
  href: string;
  title: string;
  description: string;
  comingSoon?: boolean;
  icon?: AdminHubIconKey;
  /** Shown in the left rail Primary section (always visible). */
  railPrimary?: boolean;
};

export type AdminFunctionGroup = {
  title: string;
  blurb?: string;
  items: AdminFunction[];
};

/** Collapsed under "Platform ops & audit" in the left rail (not on hub cards). */
export const ADMIN_PLATFORM_OPS_ITEMS: AdminFunction[] = [
  {
    href: "/admin/manage-backoffice",
    title: "Manage backoffice",
    description:
      "Audited core_users lookup and allowlisted field patches (subscription plan, roles, status, email, X profile, xAI collection) — constrained DB ops, not an open Mongo shell.",
    icon: "settings"
  },
  {
    href: "/admin/audit",
    title: "Audit explorer",
    description: "Browse and filter change trails across users, access requests, and xPersonas.",
    icon: "audit"
  },
  {
    href: "/admin/logins-today",
    title: "Logins today",
    description:
      "Successful and failed sign-in attempts since UTC midnight (audit_login), aligned with the hub quick stat.",
    icon: "audit"
  },
  {
    href: "/admin/login-audit",
    title: "Login audit",
    description: "Success and failed sign-in attempts with IP and time (audit_login) for security review.",
    icon: "audit"
  },
  {
    href: "/admin/xchat-tool-usage",
    title: "xChat usage & spend",
    description:
      "Tool telemetry, token-based estimates, and vendor cost_usd_ticks rollups by day / tenant / persona.",
    icon: "chat"
  }
];

export const ADMIN_FUNCTION_GROUPS: AdminFunctionGroup[] = [
  {
    title: "Books & custody",
    blurb:
      "Private / Secure — per-user books in tenant_portfolio, custodian accounts, broker catalog, and holdings CSV import.",
    items: [
      {
        href: "/admin/onboarding",
        title: "Onboarding",
        description: "Broker import workspace with optional portfolio lock via query string."
      },
      {
        href: "/admin/portfolios",
        title: "Portfolios",
        icon: "portfolio",
        railPrimary: true,
        description:
          "Private / Secure: per-user workspace portfolios in tenant_portfolio; default book uses tenantPortfolioOrgKey (org-atx-finance) under core_tenants. Edit names, tenant org ref, broker type, and default per user. Open each row’s Manage accounts for custodian CRUD, book-level desk risk & outlook (table columns), per-account risk & outlook, and watchlist on the sibling link."
      },
      {
        href: "/admin/brokers",
        title: "Brokers",
        description: "CRUD broker type slugs, display names, descriptions, and icon URLs for the portfolio catalog."
      },
      {
        href: "/admin/broker-import",
        title: "Broker import",
        description: ADMIN_BROKER_IMPORT_DESCRIPTION
      },
      {
        href: "/admin/portfolio-scoring-defaults",
        title: "Portfolio scoring factors",
        description:
          "Tenant default IV, liquidity, book-fit, and outlook weights for new portfolios and books without a stored override."
      }
    ]
  },
  {
    title: "Desk & operations",
    blurb: "Users and access, schedulers, batches, delivery, and portfolio-scoped recommendations.",
    items: [
      {
        href: "/admin/manage-users",
        title: "Manage users & access",
        icon: "users",
        railPrimary: true,
        description:
          "Directory of users plus open access requests (approve/reject), add user, sortable table, and per-user broker, portfolio, billing, and xChat defaults. Legacy /admin/access-requests redirects here."
      },
      {
        href: "/admin/tasks",
        title: "Scheduled jobs",
        icon: "calendar",
        railPrimary: true,
        description: "Create scheduled jobs, run manually, and review run history."
      },
      {
        href: "/admin/marketing",
        title: "Marketing",
        description:
          "Configure recurring social post schedules, template-driven copy, run-now executions, and delivery history."
      },
      {
        href: "/admin/batch",
        title: "Batch ops",
        description: "Track xchat batch progress, failures, and completion metrics."
      },
      {
        href: "/admin/recommendations",
        title: "Recommendations",
        description: "Admin notes and tags (session-scoped list); portfolio book recs live under Portfolios → Recommendations."
      },
      {
        href: "/admin/delivery-channels",
        title: "Delivery channels",
        description:
          "Delivery channels (in-app, Slack, email) plus developer tabs: xOptions API test, xChat API test, and test post to X."
      }
    ]
  },
  {
    title: "AI & knowledge",
    blurb: "Personas, RAG, and directory surfaces.",
    items: [
      {
        href: "/xchat",
        title: "xChat",
        icon: "chat",
        description:
          "Same signed-in product xChat as app users (AppUserApprovedHeader shell), default persona atx-trusted-advisor—not the admin advisor console."
      },
      {
        href: "/admin/personas",
        title: "Manage xPersonas",
        icon: "persona",
        railPrimary: true,
        description: "Create and edit xChat personas, models, collections, and default scope presets."
      },
      {
        href: "/admin/options-strategy-preferences",
        title: "Options strategy prefs",
        description:
          "Per-strategy markdown documents seeded from atx-docs/rag-collection/options-strategy (legacy path supported); edit names and bodies after seed:admin."
      },
      {
        href: "/admin/options-strategy",
        title: "Options strategy",
        description:
          "Canonical strategies with free-form filters JSON; seeded from atx-rag-collection/options-strategy and fully editable."
      },
      {
        href: "/admin/rag-ingest",
        title: "PDF → RAG ingest",
        description:
          "Upload desk PDFs (pymupdf4llm), review markdown under atx-docs/rag-collection/<slug>/, edit metadata, download chunks, seed Mongo + Finance xAI."
      },
      {
        href: "/admin/rag-files",
        title: "RAG collections",
        description:
          "Read-only xAI Finance collection inventory. PDF-ingested folders are tagged ingest — manage uploads on PDF → RAG ingest."
      },
      {
        href: "/personas",
        title: "xPersona directory",
        description: "Read-only list of configured xPersonas."
      }
    ]
  },
  {
    title: "Platform & compliance",
    blurb: "Observability, docs, and audit trails.",
    items: [
      {
        href: "/admin/tenant-register",
        title: "Tenant register",
        description:
          "Directory of core tenants: full id, last four, name, slug, brand accent preview, platform default, collapsible workspace/preferences JSON, tenant_admin users (email, display name, default session tenant)."
      },
      {
        href: "/admin/tenant-register/create",
        title: "Create tenant",
        description:
          "Upsert a tenant from the same fields as generate:tenant-spec + seed:tenant (no YAML file); optional initial tenant admin and xf_ui_theme."
      },
      {
        href: "/admin/tenant-preferences",
        title: "Tenant preferences",
        icon: "settings",
        railPrimary: true,
        description:
          "Workspace limits, ambient experience, default xChat persona, and feature flags — unified per-tenant configuration (legacy paths redirect here)."
      }
    ]
  }
];

const LAUNCHPAD_CTA_LIMIT = 3;

export function getAdminRailPrimaryItems(): AdminFunction[] {
  const fromGroups = ADMIN_FUNCTION_GROUPS.flatMap((g) => g.items).filter((i) => i.railPrimary);
  const seen = new Set<string>();
  return fromGroups.filter((item) => {
    if (seen.has(item.href)) {
      return false;
    }
    seen.add(item.href);
    return true;
  });
}

export function getAdminHubLaunchpadCtas(group: AdminFunctionGroup): AdminFunction[] {
  return group.items.filter((item) => !item.comingSoon).slice(0, LAUNCHPAD_CTA_LIMIT);
}

export const ADMIN_HUB_GROUP_ACCENTS = [
  "var(--xf-gain-green)",
  "var(--xf-lightning-yellow)",
  "color-mix(in srgb, var(--xf-gain-green) 70%, var(--xf-lightning-yellow))",
  "var(--xf-text-300)"
] as const;
