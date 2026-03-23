---
id: xrag-xai-design-review
name: xrag-xai-design-review
description: Review RAG architecture and xAI model/tool routing for cost, performance, grounding, and safety across agent surfaces like xChat, xCoach, and xStrategyBuilder.
---

# RAG-xAI-Design-Review: RAG and Tooling Architecture Audit

## Goal

Review RAG system design and xAI model/tool orchestration for correctness, cost-efficiency, performance, and safety in production workflows.

## When to Use

- User asks for RAG review, retrieval quality review, or model/tool routing review
- Reviewing agentic products using `xChat`, `xCoach`, `xStrategyBuilder`
- Validating design-system or architecture decisions for knowledge-grounded AI features

## Review Focus

1. **RAG architecture quality**
   - Chunking and indexing strategy align with content type (docs, code, mixed assets).
   - Retrieval is grounded and traceable (source provenance, citation path, freshness constraints).
   - Ranking and context assembly minimize hallucination risk and token waste.
2. **xAI model strategy (cost + performance)**
   - Batch model execution is used first when latency permits and work can be queued.
   - Interactive/low-latency models are reserved for real-time UX paths.
   - Route-level retry, fallback, and budget guardrails are explicit and tested.
3. **Tool routing quality**
   - `xFiles` is used for user-provided/workspace artifacts.
   - `collections_search` is used for indexed knowledge retrieval.
   - `file_search` is used for direct file-level precision lookup.
   - `web_search` is used only for freshness-sensitive external knowledge.
   - `code_execution` is used for deterministic computation and verification.
4. **Orchestration and safety**
   - Tool calls are explicit, schema-safe, and auditable.
   - Retrieval and tool sequence are minimal and purpose-driven (no redundant calls).
   - Multi-user boundaries prevent cross-tenant/context leakage.

## Output

- Structured findings:
  - RAG design gaps
  - Model routing/cost issues
  - Tooling misuse or missing tools
  - Safety and observability risks
- Prioritized fix list with expected impact (quality, latency, cost, reliability)
