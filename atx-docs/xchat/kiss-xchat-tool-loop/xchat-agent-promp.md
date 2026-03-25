How this works cleanly

Persona selection happens in the UI (dropdown or cards) before or at the start of the chat.
The chosen persona becomes the system prompt + tool baseline for that entire conversation thread.
User question is treated as the override (exactly as you said).
If the persona has an overridePrompt, it is prepended; otherwise the raw question is used.
RAG is TEAM_XAI only
Server automatically pulls:
Current portfolio_snapshot
watchlist_rationale
Past xChat history (same collection, same tenant)
No separate USER_XAI_COLL is created — everything stays in the single TEAM_XAI collection per tenant/org owner.

Grok call
One clean call to your existing /api/xchat/ask (or worker) with the assembled prompt + persona tools.
No native multi-agent model required — your orchestrator already controls the loop better.

Benefits of this exact design

Zero new collections
Full history + context always available in TEAM_XAI
Persona choice is explicit and user-controlled
Override behavior is simple and predictable
Easy to audit (entire thread lives in one collection)

This is the simplest and most maintainable version.
No extra moving parts, no cross-collection sync, and it reuses everything you already have.