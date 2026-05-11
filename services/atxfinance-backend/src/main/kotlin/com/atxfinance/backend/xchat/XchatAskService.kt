package com.atxfinance.backend.xchat

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.portfolio.PortfolioWorkspaceSnapshotService
import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.bson.Document
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.nio.charset.StandardCharsets
import java.util.UUID

@Service
class XchatAskService(
    private val atxFunctionExecutor: AtxFunctionExecutor,
    private val personaResolver: XchatPersonaResolver,
    private val auditEventService: AuditEventService,
    private val xaiToolLoopService: XaiToolLoopService,
    private val xchatRagContextService: XchatRagContextService,
    private val xchatUserPreferencesService: XchatUserPreferencesService,
    private val xchatSessionLogService: XchatSessionLogService,
    private val workspaceSnapshotService: PortfolioWorkspaceSnapshotService,
) {
    fun streamAsk(
        request: HttpServletRequest,
        session: ResolvedSession,
        emitter: SseEmitter,
        objectMapper: ObjectMapper,
        usage: XchatUsageLimitResult,
    ) {
        val startedAt = System.currentTimeMillis()
        val requestId = UUID.randomUUID().toString()
        try {
            if (session.userId.isBlank() || session.tenantId.isBlank()) {
                error("session_scope_invalid")
            }
            val body = readRequestBody(request)
            val root = parseRequestJson(body, objectMapper)
            val message = root.path("message").asText("").trim()
            val threadId = resolveThreadId(root)
            val requestedPersonaId = root.path("personaId").asText("").trim().takeIf { it.isNotEmpty() }
            val persona = personaResolver.resolveForAsk(session, requestedPersonaId)
            val personaId = persona?.getObjectId("_id")?.toHexString() ?: requestedPersonaId ?: "advisor"
            val model = XchatPersonaSupport.model(persona, "grok-4-1-fast-reasoning")
            val shouldPersistHistory = xchatUserPreferencesService.shouldPersistHistory(session)
            val correlationId = resolveCorrelationId(request, requestId)
            val executionContext = resolveExecutionContext(session, root, objectMapper)

            emit(emitter, "meta", objectMapper) {
                mapOf(
                    "v" to 1,
                    "phase" to "live_tool_loop",
                    "threadId" to threadId,
                    "model" to model,
                    "personaId" to personaId,
                )
            }

            when {
                XchatAskRouting.shouldRunOptionsActionScan(message) -> {
                    streamDirectToolPath(
                        emitter = emitter,
                        objectMapper = objectMapper,
                        operation = "options_action_scan",
                        turnIndex = 0,
                        markdownProvider = {
                            atxFunctionExecutor.executeOptionsActionScan(executionContext).let { it.markdown to it.donePayload }
                        },
                        persist =
                            buildPersistTurn(
                                shouldPersistHistory = shouldPersistHistory,
                                session = session,
                                threadId = threadId,
                                requestId = requestId,
                                correlationId = correlationId,
                                persona = persona,
                                message = message,
                                model = model,
                                startedAt = startedAt,
                            ),
                    )
                    writeTurnAudit(
                        session = session,
                        requestId = requestId,
                        action = "xchat_options_action_scan_spring",
                        details =
                            mapOf(
                                "threadId" to threadId,
                                "personaId" to personaId,
                                "usageMinute" to usage.observedMinuteCount,
                                "usageDay" to usage.observedDayCount,
                            ),
                    )
                }
                XchatAskRouting.isShowWatchlistIntent(message) -> {
                    streamDirectToolPath(
                        emitter = emitter,
                        objectMapper = objectMapper,
                        operation = "watchlist_snapshot",
                        turnIndex = 0,
                        markdownProvider = {
                            atxFunctionExecutor.executeWatchlistSnapshot(executionContext).let { it.markdown to it.donePayload }
                        },
                        persist =
                            buildPersistTurn(
                                shouldPersistHistory = shouldPersistHistory,
                                session = session,
                                threadId = threadId,
                                requestId = requestId,
                                correlationId = correlationId,
                                persona = persona,
                                message = message,
                                model = model,
                                startedAt = startedAt,
                            ),
                    )
                    writeTurnAudit(
                        session = session,
                        requestId = requestId,
                        action = "xchat_watchlist_snapshot_spring",
                        details =
                            mapOf(
                                "threadId" to threadId,
                                "personaId" to personaId,
                                "usageMinute" to usage.observedMinuteCount,
                                "usageDay" to usage.observedDayCount,
                            ),
                    )
                }
                else -> {
                    streamToolLoopPath(
                        emitter = emitter,
                        objectMapper = objectMapper,
                        message = message,
                        persona = persona,
                        personaId = personaId,
                        model = model,
                        executionContext = executionContext,
                        startedAt = startedAt,
                        shouldPersistHistory = shouldPersistHistory,
                        session = session,
                        threadId = threadId,
                        requestId = requestId,
                        correlationId = correlationId,
                    )
                    writeTurnAudit(
                        session = session,
                        requestId = requestId,
                        action = "xchat_ask_spring_tool_loop",
                        details =
                            mapOf(
                                "threadId" to threadId,
                                "personaId" to personaId,
                                "usageMinute" to usage.observedMinuteCount,
                                "usageDay" to usage.observedDayCount,
                            ),
                    )
                }
            }

            emit(
                emitter,
                "provider",
                objectMapper,
            ) {
                mapOf(
                    "handler" to "spring_xchat_phase2",
                    "durationMs" to (System.currentTimeMillis() - startedAt).coerceAtLeast(0),
                )
            }
            emitter.complete()
        } catch (ex: Exception) {
            emit(
                emitter,
                "error",
                objectMapper,
            ) {
                mapOf(
                    "message" to (ex.message ?: "xchat_stream_failed"),
                    "code" to "spring_xchat_stream_failed",
                )
            }
            emitter.completeWithError(ex)
        }
    }

    private fun writeTurnAudit(
        session: ResolvedSession,
        requestId: String,
        action: String,
        details: Map<String, Any?>,
    ) {
        runCatching {
            auditEventService.insertEvent(
                entityType = "xchat_session",
                entityId = requestId,
                action = action,
                session = session,
                details = details,
            )
        }
    }

    private fun streamToolLoopPath(
        emitter: SseEmitter,
        objectMapper: ObjectMapper,
        message: String,
        persona: Document?,
        personaId: String,
        model: String,
        executionContext: AtxFunctionExecutionContext,
        startedAt: Long,
        shouldPersistHistory: Boolean,
        session: ResolvedSession,
        threadId: String,
        requestId: String,
        correlationId: String,
    ) {
        if (message.isBlank()) {
            emit(emitter, "error", objectMapper) {
                mapOf(
                    "message" to "message is required",
                    "code" to "message_required",
                )
            }
            return
        }
        val (ragContext, ragChunkCount) = xchatRagContextService.buildRagContext(message, persona)
        val systemPrompt =
            buildString {
                append(XchatPersonaSupport.systemPrompt(persona))
                if (ragContext.isNotBlank()) {
                    appendLine()
                    appendLine()
                    append(ragContext)
                }
            }
        val loopResult =
            xaiToolLoopService.runLoop(
                model = model,
                systemPrompt = systemPrompt,
                userPrompt = message,
                tools = XchatPersonaSupport.wireTools(persona),
                toolChoice = XchatPersonaSupport.toolChoice(persona),
                maxTurns = XchatPersonaSupport.maxTurns(persona),
                executionContext = executionContext,
                streamHooks =
                    XaiToolLoopService.StreamHooks(
                        onTurnStart = { turnIndex ->
                            emit(emitter, "turn", objectMapper) { mapOf("index" to turnIndex) }
                        },
                        onToolStatus = { tool, operation, status ->
                            emit(emitter, "tool_status", objectMapper) {
                                mapOf(
                                    "tool" to tool,
                                    "operation" to operation,
                                    "status" to status,
                                )
                            }
                        },
                    ),
            )
        val output = loopResult.outputText.ifBlank { "No response from xAI." }
        for (chunk in chunkUtf16PreservingPairs(output, 140)) {
            emit(emitter, "delta", objectMapper) { mapOf("c" to chunk) }
        }
        val personaCollections = XchatPersonaSupport.linkedCollectionIds(persona).size
        val generationMs = (System.currentTimeMillis() - startedAt).coerceAtLeast(0)
        val logId =
            persistTurnIfNeeded(
                shouldPersistHistory = shouldPersistHistory,
                session = session,
                threadId = threadId,
                requestId = requestId,
                correlationId = correlationId,
                persona = persona,
                message = message,
                response = output,
                model = loopResult.model,
                xaiResponseId = loopResult.responseId,
                xaiUsage = XaiResponsesUsage.extract(loopResult.rawPayload),
                toolCalls = loopResult.toolCalls,
                interactionGenerationMs = generationMs,
            )
        emit(emitter, "done", objectMapper) {
            mapOf(
                "response" to output,
                "model" to loopResult.model,
                "personaName" to (persona?.getString("name") ?: personaId),
                "contextCount" to ragChunkCount,
                "contextSource" to if (ragChunkCount > 0) "rag_documents_search" else "none",
                "collectionSearchStatus" to if (ragChunkCount > 0) "ok" else "skipped_no_collections",
                "toolCalls" to loopResult.toolCalls,
                "logId" to logId,
                "interactionMeta" to
                    mapOf(
                        "generationMs" to generationMs,
                        "turnsUsed" to loopResult.turnsUsed,
                        "sources" to
                            mapOf(
                                "ragChunks" to ragChunkCount,
                                "toolInvocations" to loopResult.toolCalls.size,
                                "personaCollections" to personaCollections,
                                "total" to ragChunkCount + loopResult.toolCalls.size,
                            ),
                    ),
            )
        }
    }

    private fun resolveExecutionContext(
        session: ResolvedSession,
        root: JsonNode,
        objectMapper: ObjectMapper,
    ): AtxFunctionExecutionContext {
        val portfolioIdHex = root.path("portfolioId").asText("").trim().takeIf { it.isNotEmpty() }
        val inlinePreload = parseWorkspacePreload(root, objectMapper)
        if (inlinePreload != null) {
            return AtxFunctionExecutionContext(
                session = session,
                portfolioIdHex = portfolioIdHex,
                workspacePreload = inlinePreload,
            )
        }
        val rev = root.path("workspaceContentRev").asInt(-1)
        if (portfolioIdHex != null && rev >= 0) {
            val snapshot = workspaceSnapshotService.findSnapshotForSessionUser(portfolioIdHex, rev, session)
            if (snapshot != null) {
                return AtxFunctionExecutionContext(
                    session = session,
                    portfolioIdHex = portfolioIdHex,
                    workspacePreload = snapshot,
                )
            }
        }
        return AtxFunctionExecutionContext(
            session = session,
            portfolioIdHex = portfolioIdHex,
            workspacePreload = null,
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseWorkspacePreload(root: JsonNode, objectMapper: ObjectMapper): Map<String, Any?>? {
        val node = root.get("workspacePreload") ?: return null
        if (node.isNull) {
            return null
        }
        return objectMapper.convertValue(node, Map::class.java) as Map<String, Any?>
    }

    private fun resolveCorrelationId(request: HttpServletRequest, requestId: String): String {
        val header = request.getHeader("x-correlation-id")?.trim().orEmpty()
        if (header.isNotEmpty()) {
            return header
        }
        return "xcorr-$requestId"
    }

    private fun buildPersistTurn(
        shouldPersistHistory: Boolean,
        session: ResolvedSession,
        threadId: String,
        requestId: String,
        correlationId: String,
        persona: Document?,
        message: String,
        model: String,
        startedAt: Long,
    ): (String, List<Map<String, Any?>>) -> String? =
        { response, toolCalls ->
            persistTurnIfNeeded(
                shouldPersistHistory = shouldPersistHistory,
                session = session,
                threadId = threadId,
                requestId = requestId,
                correlationId = correlationId,
                persona = persona,
                message = message,
                response = response,
                model = model,
                xaiResponseId = null,
                xaiUsage = null,
                toolCalls = toolCalls,
                interactionGenerationMs = (System.currentTimeMillis() - startedAt).coerceAtLeast(0),
            )
        }

    private fun persistTurnIfNeeded(
        shouldPersistHistory: Boolean,
        session: ResolvedSession,
        threadId: String,
        requestId: String,
        correlationId: String,
        persona: Document?,
        message: String,
        response: String,
        model: String,
        xaiResponseId: String?,
        xaiUsage: XchatXaiUsageSnapshot?,
        toolCalls: List<Map<String, Any?>>,
        interactionGenerationMs: Long,
    ): String? {
        if (!shouldPersistHistory || persona?.getBoolean("keepXchatHistory") == false) {
            return null
        }
        return xchatSessionLogService.saveTurn(
            session = session,
            threadId = threadId,
            requestId = requestId,
            correlationId = correlationId,
            persona = persona,
            message = message,
            response = response,
            model = model,
            xaiResponseId = xaiResponseId,
            xaiUsage = xaiUsage,
            toolCalls = toolCalls,
            interactionGenerationMs = interactionGenerationMs,
        )
    }

    private fun streamDirectToolPath(
        emitter: SseEmitter,
        objectMapper: ObjectMapper,
        operation: String,
        turnIndex: Int,
        markdownProvider: () -> Pair<String, Map<String, Any?>>,
        persist: (String, List<Map<String, Any?>>) -> String?,
    ) {
        emit(emitter, "turn", objectMapper) { mapOf("index" to turnIndex) }
        emit(emitter, "tool_status", objectMapper) {
            mapOf(
                "tool" to "atx_function",
                "operation" to operation,
                "status" to "running",
            )
        }
        val (markdown, donePayload) = markdownProvider()
        emit(emitter, "tool_status", objectMapper) {
            mapOf(
                "tool" to "atx_function",
                "operation" to operation,
                "status" to "done",
            )
        }
        for (chunk in chunkUtf16PreservingPairs(markdown, 140)) {
            emit(emitter, "delta", objectMapper) { mapOf("c" to chunk) }
        }
        val toolCalls =
            (donePayload["toolCalls"] as? List<*>)?.mapNotNull { row ->
                row as? Map<String, Any?>
            }.orEmpty()
        val logId = persist(markdown, toolCalls)
        emit(emitter, "done", objectMapper) {
            donePayload.toMutableMap().apply {
                if (logId != null) {
                    put("logId", logId)
                }
            }
        }
    }

    private fun readRequestBody(request: HttpServletRequest): String {
        val bytes = request.inputStream.readBytes()
        if (bytes.isEmpty()) {
            return "{}"
        }
        return String(bytes, StandardCharsets.UTF_8)
    }

    private fun parseRequestJson(body: String, objectMapper: ObjectMapper): JsonNode =
        try {
            objectMapper.readTree(body.ifBlank { "{}" })
        } catch (_: Exception) {
            objectMapper.createObjectNode()
        }

    private fun resolveThreadId(root: JsonNode): String {
        val explicit = root.path("threadId").asText("").trim()
        if (explicit.isNotEmpty()) {
            return explicit
        }
        return "spring-${System.currentTimeMillis()}"
    }

    private fun emit(
        emitter: SseEmitter,
        event: String,
        objectMapper: ObjectMapper,
        data: () -> Map<String, Any?>,
    ) {
        val json = objectMapper.writeValueAsString(data())
        emitter.send(SseEmitter.event().name(event).data(json))
    }

    private fun chunkUtf16PreservingPairs(text: String, chunkChars: Int): List<String> {
        if (text.isEmpty() || chunkChars <= 0) {
            return emptyList()
        }
        val out = mutableListOf<String>()
        var i = 0
        while (i < text.length) {
            var end = (i + chunkChars).coerceAtMost(text.length)
            if (end < text.length && Character.isLowSurrogate(text[end])) {
                end -= 1
            }
            if (end <= i) {
                end = (i + 1).coerceAtMost(text.length)
            }
            out.add(text.substring(i, end))
            i = end
        }
        return out
    }
}
