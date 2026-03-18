---
id: mobile-first-responsive-ux
name: mobile-first-responsive-ux
description: Design and implement mobile-first, responsive UI/UX using Tailwind CSS and Figma-aligned workflows, optimized for touch interactions and asynchronous user flows. Use when the user asks for adaptive layouts, mobile onboarding UX, responsive components, touch-friendly design, or async interaction patterns in web apps.
---

# Mobile-First Responsive UX

## Purpose

Build adaptive, touch-first web interfaces that feel native on mobile while scaling cleanly to tablet and desktop.

## Use This Skill When

- Designing or implementing mobile-first product surfaces
- Translating Figma designs into production React/Next.js UI
- Building responsive components with Tailwind CSS
- Optimizing async interactions (loading, retry, optimistic states)
- Improving touch usability for onboarding and high-frequency actions

## Default Stack

- Design source: Figma (tokens, component variants, interaction intent)
- Styling: Tailwind CSS utility-first patterns
- Frontend: React/Next.js
- State: explicit async state models (`idle/loading/success/error`)
- Accessibility: semantic HTML + keyboard/screen-reader parity

## Mobile-First Workflow

1. Start from smallest viewport constraints first.
2. Define layout primitives (spacing, type scale, containers, touch targets).
3. Implement base styles without breakpoints.
4. Add progressive enhancements for larger screens (`sm`, `md`, `lg`).
5. Validate gesture/touch ergonomics on real mobile dimensions.
6. Test async states under slow and unstable network conditions.

## Figma-to-Code Rules

- Extract reusable design tokens (color, spacing, radius, typography).
- Map Figma variants directly to component props.
- Avoid one-off style overrides that diverge from the design system.
- Preserve interaction intent (focus, pressed, disabled, loading, success).
- Document intentional deviations when design and implementation differ.

## Tailwind Implementation Rules

- Prefer composable utility classes over ad hoc CSS files.
- Keep class groups ordered consistently for readability.
- Use `min-h`, `max-w`, and fluid spacing to prevent layout jumps.
- Avoid fixed heights for content that can grow with async data.
- Use `@layer` utilities/components only for repeated patterns.

## Touch-First Interaction Standards

- Minimum touch target: 44x44 logical pixels.
- Keep primary actions within thumb-reachable zones when possible.
- Avoid hover-only affordances; all interactions must work on touch.
- Provide immediate visual feedback on tap and async action start.
- Prevent accidental double submit with disabled/loading controls.

## Async UX Pattern

For every async action, define:
- `pending`: non-blocking indicator + disabled conflicting actions
- `success`: clear completion state and next-step affordance
- `error`: actionable message + retry path + preserved input
- `stale`: background refresh indicator where applicable

Rules:
- Never show blank screens during fetch; use skeleton or stable placeholder.
- Keep layout stable between loading and loaded states.
- Favor optimistic updates only when rollback behavior is clear.

## Responsive Layout Guardrails

- Use content-first breakpoints, not device-name assumptions.
- Keep single-column flow on narrow widths by default.
- Promote secondary content progressively on larger viewports.
- Control text line length for readability (`max-w-prose` patterns).
- Ensure modals/sheets remain usable with virtual keyboards open.

## Accessibility + Quality

- All interactive elements must have visible focus states.
- Color contrast must remain legible in light and dark surfaces.
- Form fields must have explicit labels and error associations.
- Motion should respect reduced-motion user preference.

## Checklist

Detailed checklist moved to `CHECKLIST.md`.
