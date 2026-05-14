<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# Options strategy (RAG segment)

Markdown narratives for options playbooks live in **folder-per-strategy** layout: `options-strategy/<slug>/<slug>.md` (folder name equals file stem). **`npm run seed:admin`** loads them into **Mongo** (`options_strategy` / prefs); xAI team upload is **not** part of seed (see **[`../README.md`](../README.md)**).

**Canonical index (Finance KB, lean):** [`../options-strategy-core/options-coreskills.md`](../options-strategy-core/options-coreskills.md) — strategy ↔ skill ↔ risk/outlook. **Output contract** (holdings + watchlist / Wheel · CC scan JSON): same file, § *Output contract*.

**Full playbooks (Finance KB):** [`../options-strategy-advanced/`](../options-strategy-advanced/) — multi-leg and overlay narratives; uploaded with core on **`refresh-finance`**. **`advisor`** persona YAML `always_include` is **advanced only**; **`finance-advisor`** is **core only** (see **[`../README.md`](../README.md)** § Options).

**Doc hub:** [`atx-docs/README.md`](../../README.md) § *Options (RAG + seed)*.
