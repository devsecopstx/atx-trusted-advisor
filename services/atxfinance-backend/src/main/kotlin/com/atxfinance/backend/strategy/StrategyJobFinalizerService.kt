package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.DefaultPortfolioApiService
import com.atxfinance.backend.rag.XaiDocumentsSearchClient
import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.ObjectMapper
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.core.env.Environment
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

@Service
class StrategyJobFinalizerService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val env: Environment,
    private val objectMapper: ObjectMapper,
    private val teamKb: StrategyTeamKbResolver,
    private val ragSearch: XaiDocumentsSearchClient,
    private val chat: XaiChatCompletionsClient,
    private val yahoo: StrategyOptionsYahooClient,
    private val portfolioApi: DefaultPortfolioApiService,
) {

    fun runFinalize(session: ResolvedSession, jobId: String) {
        if (!ObjectId.isValid(jobId)) {
            return
        }
        val oid = ObjectId(jobId)
        val claimed = mongoTemplate.updateFirst(
            Query.query(
                Criteria.where("_id").`is`(oid)
                    .and("userId").`is`(session.userId)
                    .and("tenantId").`is`(session.tenantId)
                    .and("status").`is`(StrategyJobService.STATUS_SLOTS_COMPLETE)
                    .and("artifactStatus").`is`("pending"),
            ),
            Update().set("artifactStatus", "running").set("updatedAt", Date()),
            props.strategyJobsCollection,
        )
        if (claimed.modifiedCount == 0L) {
            return
        }

        val job = mongoTemplate.findById(oid, Document::class.java, props.strategyJobsCollection)
        if (job == null) {
            return
        }

        try {
            val key = env.getProperty("XAI_API_KEY")?.trim()
            if (key.isNullOrEmpty()) {
                markFailed(oid, "artifact_xai_unconfigured", "XAI_API_KEY is not configured")
                return
            }

            val slots = job.get("slots", Document::class.java) ?: Document()
            val searchQuery = buildRagQuery(slots)
            val collectionIds = teamKb.resolveCollectionIds()
            val ragSnippets: List<XaiDocumentsSearchClient.Snippet> = try {
                if (collectionIds.isEmpty()) {
                    emptyList()
                } else {
                    ragSearch.search(searchQuery, collectionIds, topK = 6)
                }
            } catch (e: Exception) {
                markFailed(oid, "artifact_rag_failed", e.message ?: "RAG search failed")
                return
            }

            val portfolio: Map<String, Any?> = try {
                portfolioApi.loadSummaryPayload(session)
            } catch (e: Exception) {
                mapOf("error" to (e.message ?: "portfolio_load_failed"))
            }

            val underlying = slots.getString("underlying")?.trim()?.uppercase().orEmpty()
            val quote: Map<String, Any?>? = if (underlying.isNotEmpty()) {
                yahoo.fetchUnderlyingQuote(underlying)
            } else {
                null
            }

            val bundle = buildUserBundle(slots, ragSnippets, portfolio, quote, collectionIds.isEmpty())
            val system = FINALIZER_SYSTEM_PROMPT
            val (model, agentCount, effort) = resolveModel(session)
            val completion = try {
                chat.complete(
                    model = model,
                    system = system,
                    user = bundle,
                    temperature = 0.2,
                    agentCount = agentCount,
                    reasoningEffort = effort,
                )
            } catch (e: Exception) {
                markFailed(oid, "artifact_xai_error", e.message ?: "xAI chat failed")
                return
            }

            when (val parsed = StrategyArtifactV1Parser.parseFullOutput(completion.outputText, objectMapper)) {
                is StrategyArtifactParseResult.Failure -> {
                    markFailed(oid, parsed.code, parsed.message)
                }
                is StrategyArtifactParseResult.Ok -> {
                    val bsonJson = Document.parse(objectMapper.writeValueAsString(parsed.json))
                    mongoTemplate.updateFirst(
                        Query.query(Criteria.where("_id").`is`(oid)),
                        Update()
                            .set("artifactStatus", "ready")
                            .set("artifactMarkdown", parsed.markdown)
                            .set("artifactJson", bsonJson)
                            .set("artifactModel", completion.model)
                            .unset("artifactErrorCode")
                            .unset("artifactErrorMessage")
                            .set("updatedAt", Date()),
                        props.strategyJobsCollection,
                    )
                }
            }
        } catch (e: Exception) {
            markFailed(oid, "artifact_internal_error", e.message ?: "finalize failed")
        }
    }

    private fun resolveModel(session: ResolvedSession): Triple<String, Int?, String?> {
        var model = props.strategyFinalizerModel.trim().ifEmpty { "grok-4-1-fast-reasoning" }
        val multiModels = setOf("grok-4.20-multi-agent", "grok-4.20-multi-agent-0309")
        val isMulti = multiModels.contains(model)
        if (isMulti && session.roles.contains("global_admin") && props.strategyFinalizerMultiAgentForGlobalAdmin) {
            return Triple(model, 4, "medium")
        }
        if (isMulti) {
            val fallback = env.getProperty("STRATEGY_FINALIZER_NON_ADMIN_MODEL")?.trim()
                ?: "grok-4-1-fast-reasoning"
            model = fallback
        }
        return Triple(model, null, null)
    }

    private fun markFailed(oid: ObjectId, code: String, message: String) {
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(oid)),
            Update()
                .set("artifactStatus", "failed")
                .set("artifactErrorCode", code.take(128))
                .set("artifactErrorMessage", message.take(2000))
                .set("updatedAt", Date()),
            props.strategyJobsCollection,
        )
    }

    private fun buildRagQuery(slots: Document): String {
        val parts = listOf(
            slots.getString("underlying"),
            slots.getString("outlook"),
            slots.getString("risk"),
            slots.getString("horizon"),
            slots.getString("capital"),
        ).mapNotNull { it?.trim()?.takeIf { s -> s.isNotEmpty() } }
        return parts.joinToString(" ").ifEmpty { "options strategy playbook" }
    }

    private fun buildUserBundle(
        slots: Document,
        rag: List<XaiDocumentsSearchClient.Snippet>,
        portfolio: Map<String, Any?>,
        quote: Map<String, Any?>?,
        ragSkippedNoCollection: Boolean,
    ): String {
        val ragBlock = if (ragSkippedNoCollection) {
            "(No TEAM KB collection id resolved — XAI_TEAM_ID should be collection_* or set STRATEGY_TEAM_KB_COLLECTION_ID.)"
        } else if (rag.isEmpty()) {
            "(No RAG snippets returned for this query.)"
        } else {
            rag.joinToString("\n---\n") { s ->
                buildString {
                    appendLine("[snippet]")
                    s.documentName?.let { appendLine("doc: $it") }
                    s.documentId?.let { appendLine("id: $it") }
                    appendLine(s.text)
                }
            }
        }
        val slotsJson = objectMapper.writeValueAsString(slots)
        val portfolioJson = objectMapper.writeValueAsString(portfolio)
        val quoteJson = quote?.let { objectMapper.writeValueAsString(it) } ?: "null"
        return buildString {
            appendLine("## Collected slots (JSON)")
            appendLine(slotsJson)
            appendLine()
            appendLine("## Team KB retrieval snippets")
            appendLine(ragBlock)
            appendLine()
            appendLine("## Portfolio snapshot (JSON)")
            appendLine(portfolioJson)
            appendLine()
            appendLine("## Latest quote for underlying (JSON or null)")
            appendLine(quoteJson)
        }
    }

    companion object {
        private val FINALIZER_SYSTEM_PROMPT = """
            You are an institutional-grade options strategy advisor for xFinance Phase 1 strategy jobs.
            Using ONLY the user bundle (slots, KB snippets, portfolio snapshot, quote), produce:
            1) A concise Markdown brief (headings allowed) summarizing the recommended structure, risks, and fit to the user's outlook/risk/horizon.
            2) A single fenced JSON code block labeled ```json containing artifact version 1 with this exact shape:
            {
              "version": "1",
              "underlying": "<ticker or null>",
              "structure": "<short structure name e.g. covered_call>",
              "rational_recommendation": "<non-empty prose tying slots + data together>",
              "legs": [
                { "side": "buy|sell", "type": "call|put|stock", "strike": <number or null>, "expiry": "<ISO date or short text>", "quantity": <number> }
              ]
            }
            Rules:
            - rational_recommendation MUST be non-empty.
            - legs MUST be an array (empty array allowed only if you refuse with explicit rationale in rational_recommendation).
            - Do NOT fabricate live prices not present in the bundle; if quote missing, say so in prose.
            - Output the ```json fence exactly once after the Markdown brief.
            - No silent fallback: if data is insufficient, still return valid JSON with rational_recommendation explaining gaps and legs=[].
        """.trimIndent()
    }
}
