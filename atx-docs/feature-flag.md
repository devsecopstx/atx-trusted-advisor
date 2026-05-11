# Feature Flags & Unified Tenant Preferences Admin Page

**Status:** Design & Implementation Spec for Cursor Agent  
**Owner:** The Architect (20+ yrs enterprise trading platform delivery)  
**Date:** 2026-05-10  
**Priority:** High — eliminate env-var churn for feature rollouts on the HNWI conversational portfolio & options platform.

## Executive Summary (Architect's Perspective)

In regulated financial platforms serving high-net-worth individuals (HNWI), every config change must be:
- **Zero-downtime** (no redeploy for a simple toggle)
- **Auditable** (who changed what, when, with full lineage)
- **Per-tenant granular** (different rollouts for core vs white-label tenants)
- **Conservative by default** (new features ship disabled; explicit enable in admin only)

Current separate pages (`/admin/tenant-preferences/ambient`, `/workspace-limits`, `/default-persona`) create maintenance debt and slow operator workflows. We consolidate them into **one clean, production-grade admin surface** while introducing a first-class **feature flag system** backed by Mongo (no more `process.env.NEW_EXPERIMENTAL_*`).

**Outcome:** New features (e.g. wheel-strategy visual, voice input, advanced rebalance rules, IBKR live-order preview) are toggled instantly via admin UX. Runtime reads from `core_tenants.tenantPreferences.featureFlags` (or platform defaults) with sub-50ms cached lookup. Full ShedLock-safe, audit-wrapped, global_admin only.

This aligns with our shipped stack (Next.js 16 + Spring BFF + Mongo) and existing tenant UX patterns (see `tenant-ux-plan.md`, `current-state-features.md`).

## Current State Analysis

From live screenshots and docs:
- **Workspace Limits** (`/admin/tenant-preferences/workspace-limits`): Full editable table for `xoptionsViewsHrPerUser`, `xchatPromptsDayPerUser`, `xchatPromptsHrPerUser`, `portfoliosPerUser`, `accountsPerPortfolio`, `maxUsers`, `userJobsPerUser`, `changePersonaEnabled`, `chatHistoryMax`, `xchatDebug`, `xchatBrand`, `xsbBrand`. Per-tenant row with Reload / Reset draft / Save. Enforced in `ask-usage-limits` + plan merge.
- **Ambient Experience** (`/admin/tenant-preferences/ambient`): Radio group for `ambient_market_veil` (`default` | `on` | `off`). Pure Canvas2D teal grid + drifting particles behind product chrome. Auto-throttles <45fps, respects `prefers-reduced-motion`. Stored in `core_tenants.tenantPreferences.ambient_market_veil`.
- **Default xChat Persona** (`/admin/tenant-preferences/default-persona` or admin xChat settings): Dropdown of published `xPersonas`. Platform fallback to seeded "trusted-advisor". Not per-tenant today (stored outside tenant doc).

**Pain points:** Three separate routes, inconsistent draft/reset UX, no single Save, no way to introduce *new* flags without code + env + deploy.

## Target Unified Page

**Route:** `/admin/tenant-preferences` (global_admin only)

**Layout (clean, operator-fast):**
- Top: Tenant selector (dropdown populated from `core_tenants`, default = session tenant or "atxFinance Core • default")
- Global actions: Reload all | Reset all drafts | Save All Changes (disabled until dirty)
- Four collapsible / tabbed sections (use `<Tabs>` or stacked `<Card>` with independent dirty tracking for safety):
  1. **Workspace Limits** — exact existing table (numbers, checkboxes, brand inputs)
  2. **Ambient Experience** — radio group + live preview hint ("Subtle teal grid + drifting accent particles...")
  3. **xChat Default Persona** — select published persona + note on fallback behavior
  4. **Feature Flags** (new) — dynamic table + "Add Flag" form

**Design System Alignment:**
- Dark theme, `--xf-*` tokens, lucide icons (RotateCw, Save, Plus)
- Consistent with existing tenant-preferences cards (border, shadow, input styling)
- Mobile-responsive (table → cards on <640px)
- Accessibility: aria labels on every control, live region for save status

## Data Model (Mongo)

Extend existing `core_tenants.tenantPreferences` (no migration needed — partial updates are safe):

```ts
interface TenantPreferences {
  ambient_market_veil?: {
    mode: 'default' | 'on' | 'off';
  };
  workspaceLimits?: WorkspaceLimits; // existing shape
  defaultXchatPersona?: string; // slug or ObjectId of published xPersona (per-tenant override possible)
  featureFlags?: Record<string, boolean | number | string | object>; // flexible, versioned by key
  // future: featureFlagsMeta for rollout %, startDate, etc.
}
```

**Platform defaults** live in code (`src/lib/tenant-defaults.ts` or `tenant_defaults.yaml` seed) and are merged at read time (see `mergeTenantWorkspaceLimits` pattern).

**New collection (optional v2):** `core_feature_flags` for global flag registry + per-tenant overrides (for advanced rollout). Start simple with `tenantPreferences.featureFlags`.

## Runtime API & Helpers (Production Hardening)

**New file:** `src/lib/feature-flags.ts`

```ts
import { getCoreTenant } from '@/modules/core-tenant/repository';

// Cached (Redis or in-memory 30s TTL) for hot paths (xChat ask, xOptions load)
export async function isFeatureEnabled(
  tenantId: string,
  flagKey: string,
  defaultValue = false
): Promise<boolean> {
  const tenant = await getCoreTenant(tenantId);
  const flags = tenant?.tenantPreferences?.featureFlags ?? {};
  return flags[flagKey] ?? defaultValue;
}

// Generic getter for any preference
 export async function getTenantPreference<T>(tenantId: string, path: string, defaultValue: T): Promise<T> { ... }
```

**Usage in new feature (example — wheel strategy visual):**
```ts
if (await isFeatureEnabled(tenantId, 'wheelStrategyVisual', false)) {
  return <WheelStrategyMotion />;
}
```

**Admin API (consolidate or extend):**
- `GET /api/admin/tenant-preferences?tenantSlug=...` — returns merged defaults + overrides
- `PATCH /api/admin/tenant-preferences` — body `{ section: 'workspaceLimits' | 'ambient' | 'persona' | 'featureFlags', payload: Partial<...> }`
  - Validates with Zod per section
  - Writes audit event (`admin_audit_events`, trigger: `global_admin:${username}`)
  - Invalidates any Redis cache key for that tenant

Reuse existing `GET/PATCH /api/admin/tenants/{tenantId}/workspace-limits` for backward compat; new unified route for the combined page.

## Step-by-Step Implementation Instructions for Cursor

### Phase 1: Data & API Layer (1–2 hrs)
1. Update `src/modules/core-tenant/types.ts` (or wherever Tenant doc lives) with the extended `TenantPreferences` interface above.
2. Create or update `src/app/api/admin/tenant-preferences/route.ts`:
   - GET: load tenant by slug or id (session or query), return `{ tenantPreferences: merged, publishedPersonas: [...] }`
   - PATCH: switch on `section`, merge into `tenantPreferences`, `$set` only changed keys, write audit, return 200 + new doc.
3. Add Zod schemas: `workspaceLimitsSchema`, `ambientSchema`, `personaSchema`, `featureFlagSchema` (key: slug regex `^[a-z0-9-]+$`, value: any).
4. Update `mergeTenantWorkspaceLimits` (or new `resolveTenantPreferences`) to include featureFlags merge (shallow for v1).

### Phase 2: Unified UI Page (3–4 hrs)
1. Create `src/app/admin/tenant-preferences/page.tsx` (protected by `global_admin` role check via existing `surface-policy.ts` or proxy).
2. **Tenant Selector:** `<Select>` populated via `GET /api/admin/tenants` (or existing catalog). On change → reload all sections. Persist selection in URL query or localStorage for operator flow.
3. **Shared State:** Use `useState` + `useEffect` for draft vs saved per section. Track `dirtySections: Set<string>`.
4. **Section 1 — Workspace Limits:** Copy-paste existing form from `src/app/admin/tenant-preferences/workspace-limits/page.tsx`. Wrap inputs in controlled components. On change mark dirty.
5. **Section 2 — Ambient Experience:** Radio group (Default / On / Off) with descriptions exactly as screenshot. Add subtle live preview box (static or small Canvas demo if time).
6. **Section 3 — Default xChat Persona:** `<Select>` loaded from `GET /api/personas?published=true`. Show current + fallback note. Allow per-tenant override (future-proofs persona assignment).
7. **Section 4 — Feature Flags (the key new capability):**
   ```tsx
   <Card>
     <Table>
       {Object.entries(draft.featureFlags || {}).map(([key, val]) => (
         <tr key={key}>
           <td>{key}</td>
           <td><Switch checked={!!val} onCheckedChange={v => updateFlag(key, v)} /></td>
           <td><Button variant="ghost" onClick={() => removeFlag(key)}>Remove</Button></td>
         </tr>
       ))}
     </Table>
     <form onSubmit={addNewFlag}>
       <Input placeholder="flag-key-slug" />
       <Select type={['boolean','number']} />
       <Input placeholder="Description for operators" />
       <Button type="submit">Add Flag</Button>
     </form>
   </Card>
   ```
   - On add: validate key not duplicate, default value per type, update draft.featureFlags.
   - Note in UI: "Flag values are live immediately. Code must call isFeatureEnabled() to consume."
8. **Save All:** One button that collects dirty sections, calls PATCH for each (or single batched PATCH), shows toast "Preferences saved — changes live for all signed-in users" + audit confirmation.
9. **Reset Draft:** Per section or global — re-fetches from server.

### Phase 3: Polish, Tests & Docs (2 hrs)
1. Add loading skeletons matching existing tenant-preferences pages.
2. Error handling: 403 for non-global_admin, 429 rate limit on save, validation messages inline.
3. Unit tests: `tests/unit/tenant-preferences-merge.test.ts` (featureFlags shallow merge, persona fallback).
4. Integration: `tests/integration/admin-tenant-preferences.test.ts` (happy path save + audit row created).
5. Update:
   - `atx-docs/current-state-features.md` (add route to admin surfaces table)
   - `atx-docs/PLAN.md` (close any related backlog items)
   - `AGENTS.md` (new section: "Adding a feature flag — use admin, never env var")
   - `guides/api-endpoints.md` (document new unified route)
6. Optional: Add Redis cache invalidation on PATCH (key: `tenant:preferences:${tenantId}`).

## Rollout & Governance (Production-Grade)
- **Default posture:** All new flags default `false` in code + DB. Explicit admin enable only.
- **Audit:** Every PATCH writes to `admin_audit_events` with before/after diff (reuse existing pattern).
- **RBAC:** global_admin only. Tenant admins see read-only view (future phase).
- **Backwards compat:** Existing separate routes continue to work (no breaking change). Old pages can redirect to new unified after migration.
- **Perf:** Feature flag reads are cached; hot paths (xChat ask, strategy job start) see <10ms added latency.
- **Compliance note (for HNWI/regulated tenants):** Flag changes are immutable audit events — exportable for SOC2 / exam requests.

## Example New Feature Integration (Post-Implementation)

To ship "voice input (703)" without env var:
1. Add `if (await isFeatureEnabled(tenantId, 'voiceInput', false)) { enableWebSpeech... }` in xChat composer.
2. Operator goes to `/admin/tenant-preferences` → Feature Flags → Add `voiceInput` (boolean, default false) → toggle on for specific tenant or globally via default tenant.
3. No deploy, no restart, instant for all users in that tenant.

## Success Criteria
- Single page loads <800ms (Lighthouse).
- Save completes with audit row in <300ms.
- New flag visible in admin within 5s of code deploy (no env needed).
- Zero production incidents from config changes (tracked via release notes).

**This is the conservative, balanced, scalable path forward.** Ready for immediate Cursor implementation. Questions on edge cases (multi-replica ShedLock on flag reads, planOverrides merge for flags, etc.) — escalate to Architect.

---
*End of spec. Cursor: implement exactly as written, then run `npm run ci:gate` + reviewer checklist before any PR.*