# options-strategy (RAG source)

Canonical **options strategy narratives** for **`npm run seed:admin`** → xAI trusted-advisor segment **`…-options-strategy`** (see **`scripts/lib/seed-xai-rag-ingest.mjs`**).

## Entry points

| Doc | Role |
| --- | --- |
| **[options-coreskills/options-coreskills.md](./options-coreskills/options-coreskills.md)** | Strategy map, risk/outlook columns, links to `.cursor/skills/skill-*` |

## Layout rule (RAG path tags)

Each ingestible file lives in a **folder whose name matches the file stem** (e.g. `wheel/wheel.md`, `options-coreskills/options-coreskills.md`). That keeps upload names and retrieval tags stable. **`README.md`** files at segment roots are skipped by ingest (lowercase `readme.md` filter).

Human-facing doc links: **`atx-docs/README.md`** § *Options (RAG + seed)* (canonical index — no `atx-docs/atx-options/` folder).
