import { ADMIN_BROKER_IMPORT_DESCRIPTION } from "@/app/admin/lib/broker-import-description";

export type AdminFunction = {
  href: string;
  title: string;
  description: string;
  comingSoon?: boolean;
};

export type AdminFunctionGroup = {
  title: string;
  blurb?: string;
  items: AdminFunction[];
};

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
      }
    ]
  },
  {
    title: "People & access",
    blurb: "User lifecycle, roles, and access requests.",
    items: [
      {
        href: "/admin/access-requests",
        title: "Access",
        description: "Access requests: review pending items, approve or reject, and submit new role requests."
      },
      {
        href: "/admin/manage-users",
        title: "Manage users",
        description: "Browse approved users, adjust roles and plans, and edit per-user broker, portfolio, and notification defaults."
      }
    ]
  },
  {
    title: "Desk & operations",
    blurb: "Schedulers, batches, and portfolio-scoped recommendations.",
    items: [
      {
        href: "/admin/tasks",
        title: "Scheduler tasks",
        description: "Create scheduled tasks, run jobs manually, and monitor status."
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
        description:
          "Same signed-in product xChat as app users (AppUserApprovedHeader shell), default persona atx-trusted-advisor—not the admin Super-Agent console."
      },
      {
        href: "/admin/personas",
        title: "Manage xPersonas",
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
        href: "/admin/rag-files",
        title: "RAG collections",
        description: "Read-only xAI collection inventory for this management API key."
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
        href: "/admin/tenant-preferences/workspace-limits",
        title: "Workspace limits",
        description:
          "Per-tenant quotas on core_tenants.workspaceLimits; tenant_preferences (xChat debug, one-time branding aliases)."
      },
      {
        href: "/admin/tenant-preferences/default-persona",
        title: "Default xChat persona",
        description:
          "Platform default published xPersona for app users who do not have an admin-assigned persona."
      },
      {
        href: "/admin/manage-backoffice",
        title: "Manage backoffice",
        description:
          "Audited core_users lookup and allowlisted field patches (subscription plan, roles, status, email, X profile, xAI collection) — constrained DB ops, not an open Mongo shell."
      },
      {
        href: "/admin/audit",
        title: "Audit explorer",
        description: "Browse and filter change trails across users, access requests, and xPersonas."
      },
      {
        href: "/admin/api-docs",
        title: "API docs",
        description: "OpenAPI current-state and interactive API documentation."
      },
      {
        href: "/admin/xchat-tool-usage",
        title: "xChat tool usage",
        description: "Tool call telemetry for xChat operational review."
      }
    ]
  },
  {
    title: "Developer & integration",
    blurb: "Temporary tooling; fold into product flows when stable.",
    items: [
      {
        href: "/admin/xoptions",
        title: "xOptions API test",
        description:
          "TODO: Remove or merge into product when strategy-options is fully integrated. Exercise GET expirations and option-chain reads (BFF / backend parity)."
      },
      {
        href: "/admin/xchat-api-test",
        title: "xChat API test",
        description:
          "Run canned POST /api/xchat/ask checks (including code_interpreter prompts) to verify persona tool wiring and response payloads."
      }
    ]
  }
];
