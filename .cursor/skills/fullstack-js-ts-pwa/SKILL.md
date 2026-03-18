---
id: fullstack-js-ts-pwa
name: fullstack-js-ts-pwa
description: Build production-grade full-stack JavaScript/TypeScript apps using Node.js backend APIs and Next.js/React frontends with mobile-responsive, PWA-style delivery. Use when the user asks for cross-platform web apps, mobile-friendly onboarding, responsive UI architecture, API-to-UI integration, or avoiding native app overhead.
---

# Full-Stack JS/TS PWA

## Purpose

Deliver cross-platform, mobile-friendly product experiences using a single TypeScript codebase across backend and frontend.

## Use This Skill When

- Building or refactoring Node.js APIs for frontend consumption
- Implementing Next.js App Router pages, route handlers, or server actions
- Creating responsive React UX for onboarding and account flows
- Adding PWA capabilities (installability, offline resilience, caching)
- Optimizing mobile web behavior without native app development

## Default Stack

- Language: TypeScript (strict, no `any`)
- Backend: Node.js APIs (REST-first with clear contracts)
- Frontend: Next.js + React (App Router)
- Data transport: typed JSON contracts with runtime validation
- Mobile UX: responsive layouts + touch-first interactions
- PWA: manifest + service worker + cache strategy

## Architecture Workflow

1. Define typed domain contracts shared across API and UI layers.
2. Implement backend endpoints with explicit validation and error taxonomy.
3. Build UI flows that consume those contracts without shape drift.
4. Add responsive patterns from mobile-first breakpoints upward.
5. Add PWA primitives for install and degraded-network behavior.
6. Instrument performance and error reporting across client/server boundaries.

## API Contract Rules

- Use stable request/response types and version changes intentionally.
- Validate all input at the API edge.
- Return predictable error shapes with machine-readable `code`.
- Avoid overfetching; support pagination and selective fields when needed.

Example error shape:

```ts
export type ApiError = {
  code:
    | "validation_error"
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "conflict"
    | "rate_limited"
    | "internal_error";
  message: string;
  requestId: string;
};
```

## Frontend Responsiveness Rules

- Design for smallest common mobile viewport first.
- Keep tap targets large and spacing touch-safe.
- Prefer CSS grid/flex layouts over device-specific hacks.
- Avoid blocking modals during critical onboarding steps.
- Preserve state during refresh/back navigation where feasible.

## PWA Delivery Pattern

Required pieces:
- `manifest.webmanifest` with icons, theme, start URL, display mode
- service worker registration with versioned cache strategy
- offline fallback route for critical onboarding/read-only surfaces
- runtime cache policy tuned by asset type (static vs API)

Rules:
- Cache immutable static assets aggressively.
- Use stale-while-revalidate for non-critical API reads.
- Never cache sensitive authenticated responses blindly.

## Mobile-Friendly Onboarding Pattern

1. Minimize steps and reduce field count per screen.
2. Persist progress checkpoints after each successful step.
3. Use optimistic UI only when rollback is straightforward.
4. Handle session expiration with recovery path, not dead ends.
5. Track drop-off events by step to guide iteration.

## Performance Baselines

- Prioritize low JS payload and route-level code splitting.
- Stream server-rendered content where possible.
- Defer non-critical scripts and third-party tags.
- Keep interaction latency low on mid-tier mobile devices.

## Security + Reliability

- Enforce auth at API boundaries and server-rendered data paths.
- Sanitize user input and encode output correctly.
- Apply rate limits to onboarding/auth endpoints.
- Include idempotency keys for retry-prone writes.

## Checklist

Detailed checklist moved to `CHECKLIST.md`.
