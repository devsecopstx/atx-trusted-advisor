# MongoDB — `prompt_templates`

**Purpose:** versioned, tenant-overridable **prompt bodies** for product features (e.g. HNWI **Desk Report v2.1** xChat quick actions). Global defaults ship with `tenantId: null`; tenants may clone rows with their own `tenantId` for desk-specific wording.

**Collection name:** `prompt_templates`

## Document shape

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | auto | Primary key |
| `slug` | string | yes | Stable key (e.g. `hnwi-v21-wheel-cc`) |
| `version` | string | yes | Semver or label (e.g. `2.1`) |
| `tenantId` | ObjectId \| null | yes | **`null`** = platform default visible to all tenants after merge rules |
| `prompt_text` | string | yes | User/composer-facing instructions |
| `output_schema` | string | optional | Logical schema id (e.g. `hnwi_desk_report_v2.1_markdown`) |
| `active` | boolean | yes | Inactive rows are ignored by resolvers |
| `bias_defaults` | object | optional | JSON bag for desk defaults (e.g. `riskProfile`, `outlook`) — advisory only |
| `createdAt` | Date | optional | Audit |
| `updatedAt` | Date | optional | Audit |

## Indexes (seed)

- **Unique:** `{ slug: 1, tenantId: 1, version: 1 }` — `uniq_prompt_template_slug_tenant_version`
- **Lookup:** `{ slug: 1, tenantId: 1, active: 1 }` — `idx_prompt_templates_slug_tenant_active`

## Resolution order

1. `{ slug, tenantId: <session tenant>, active: true }`
2. Else `{ slug, tenantId: null, active: true }`
3. Else built-in text from `prompt-templates-v21-defaults.ts`

## Ops

- **Seed / upsert global v2.1 rows:** `npm run seed:prompt-templates-v21`
- **Also runs** as part of `npm run seed:admin` unless `SKIP_SEED_PROMPT_TEMPLATES_V21=1`
