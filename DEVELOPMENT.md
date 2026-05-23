# atxFinance Core App Development

Content migrated to:

- `atx-docs/guides/README.md`

Compatibility anchors retained for legacy links:

<a id="scope"></a>
<a id="documentation-tree"></a>
<a id="tech-stack"></a>
<a id="platform-roles-vs-tenant-membership-session"></a>
<a id="required-environment-keys"></a>
<a id="local-setup-backend--frontend"></a>
<a id="cursor-cloud-agent-setup-atlas-mode"></a>
<a id="oauth-host-consistency"></a>
<a id="validation-commands"></a>
<a id="sre-runbook-local-health-tests-and-ci-gate"></a>
<a id="api-endpoints"></a>
<a id="api-docs-validation"></a>
<a id="access-request-state-machine"></a>
<a id="persona-governance"></a>
<a id="plan-limits-and-cost-controls"></a>
<a id="xpersona-collection-endpoint-notes"></a>
<a id="multi-tenant-seed-verification"></a>
<a id="batch-knowledge-base-workaround"></a>
<a id="app_user-http-500"></a>
<a id="deployrollback-operations"></a>
<a id="design-and-branding"></a>
<a id="branding-tokens"></a>

## Branding Tokens

Visual tokens live in [`atx-docs/design-system/atxfinance-brand-kit.css`](atx-docs/design-system/atxfinance-brand-kit.css) (imported from `src/app/layout.tsx`). Narrative rules: [`.cursor/rules/xfinance-branding.mdc`](.cursor/rules/xfinance-branding.mdc) · [`atx-docs/xchat/xfinance-branding-review.md`](atx-docs/xchat/xfinance-branding-review.md).

### Green token usage (authoritative)

| Token / Class | Usage Location | Meaning | Example Component |
| --- | --- | --- | --- |
| `--xf-green-500` / `text-green-500` | Success states, scanner hits, “what worked” checks | Positive premium capture / filter pass | Weekly recap, scanner results |
| `--xf-green-400` / `bg-green-400` | Subtle highlights, IV rank badges | Moderate positive / watchlist hot | xOptions heat map, portfolio rail |
| `text-emerald-500` (`--xf-accent-cta`) | Defined-risk play cards, wheel variants | New income strategy available | New defined-risk wheel card |
| `border-green-500` (`--xf-green-500`) | Active CTA borders, payoff preview | Recommended action | xOptions Step 4 CTA |

**Tailwind:** `text-xf-green-500`, `bg-xf-green-400`, `text-xf-accent-cta`, `border-xf-green-500` (see `tailwind.config.ts`). **Legacy:** `--xf-gain-green` (#39ff14) stays for wordmark “Gains”, marketing tagline, and nav chrome — not for the semantic rows above.

